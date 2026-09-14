// Eleventy configuration for Vangmar.pl
//
// The hard requirement of this site is URL preservation: every address the
// WordPress blog served must keep working, because they are linked from social
// media. Post URLs are therefore never derived from file paths — each post
// declares its exact legacy address in a `permalink:` front matter field.

import { HtmlBasePlugin } from "@11ty/eleventy";
import * as cheerio from "cheerio";

/**
 * Where the site is served from.
 *
 * At the real domain this is "/" and everything below is a no-op. But a GitHub
 * Pages *project* site is served under the repository name — currently
 * https://vangmar.github.io/www.vangmar.pl/ — where root-relative paths such as
 * /assets/css/author.css resolve to the wrong place and 404. Setting
 * PATH_PREFIX makes the build emit that prefix on every internal link.
 *
 * This only affects generated links, never the output file layout, so the
 * permalinks that must be preserved are unaffected either way.
 */
const PATH_PREFIX = process.env.PATH_PREFIX || "/";

const PL_MONTHS = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** English ordinal suffix, as WordPress' `jS` date token produces it. */
function ordinal(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
}

/** "November 2023" / "czerwiec 2025" — how WordPress labelled month archives. */
function monthLabel(date, lang) {
  const months = lang === "pl" ? PL_MONTHS : EN_MONTHS;
  return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Dates are read from front matter as plain `YYYY-MM-DD` local wall-clock
 * dates, so they must be formatted in UTC — using local getters would shift
 * the day backwards for anyone building west of Greenwich.
 */
function dateParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

export default function (eleventyConfig) {
  /*
   * Rewrites root-relative URLs in the generated HTML to sit under PATH_PREFIX.
   *
   * Templates alone cannot do this: post bodies are stored as the original
   * WordPress HTML, so their <img src="/wp-content/uploads/..."> attributes
   * never pass through a template filter. This plugin rewrites the finished
   * HTML instead, which catches those too. With PATH_PREFIX at its "/" default
   * it changes nothing.
   */
  eleventyConfig.addPlugin(HtmlBasePlugin);

  // Assets keep their original WordPress paths (/wp-content/uploads/...) so that
  // image URLs shared to Pinterest and Facebook resolve unchanged.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/wp-content");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  // "17th November 2023" (en) / "11th czerwiec 2025" (pl) — WordPress' `jS F Y`.
  // The Polish original renders the English ordinal suffix too; kept as-is so
  // the rebuilt pages match what the live site serves.
  eleventyConfig.addFilter("postDate", (date, lang = "en") => {
    const { year, month, day } = dateParts(date);
    const months = lang === "pl" ? PL_MONTHS : EN_MONTHS;
    return `${day}${ordinal(day)} ${months[month]} ${year}`;
  });

  // Archives widget labels, sharing one implementation with the collection.
  eleventyConfig.addFilter("monthLabel", (date, lang = "en") => monthLabel(date, lang));

  // WordPress date archives: /2023/11/ (en) and /pl/2023/11/ (pl).
  eleventyConfig.addFilter("monthUrl", (date, lang = "en") => {
    const { year, month } = dateParts(date);
    const mm = String(month + 1).padStart(2, "0");
    return lang === "pl" ? `/pl/${year}/${mm}/` : `/${year}/${mm}/`;
  });

  eleventyConfig.addFilter("isoDate", (date) => date.toISOString());

  eleventyConfig.addFilter("byLang", (posts, lang) =>
    posts.filter((post) => post.data.lang === lang));

  /**
   * The posts either side of `url` in an already-sorted list. Because the list
   * runs newest-first, the preceding entry is the newer post.
   * Returns `{ newer, older }`, each possibly null.
   */
  eleventyConfig.addFilter("adjacent", (posts, url) => {
    const at = posts.findIndex((post) => post.url === url);
    if (at === -1) return { newer: null, older: null };
    return {
      newer: at > 0 ? posts[at - 1] : null,
      older: at < posts.length - 1 ? posts[at + 1] : null,
    };
  });

  /** First `count` items. Nunjucks' own `slice` splits into chunks instead. */
  eleventyConfig.addFilter("take", (items, count) => items.slice(0, count));

  /**
   * One entry per month that has posts, newest first — the Archives widget.
   * Posts must already be sorted newest-first for the order to hold.
   */
  eleventyConfig.addFilter("archiveMonths", (posts) => {
    const months = new Map();
    for (const post of posts) {
      const key = `${post.date.getUTCFullYear()}-${post.date.getUTCMonth()}`;
      if (!months.has(key)) months.set(key, post.date);
    }
    return [...months.values()];
  });

  /** Absolute URL, for canonical links, Open Graph tags and feeds. */
  eleventyConfig.addFilter("absolute", (path, base) =>
    new URL(path, base).href);

  /**
   * A post body reduced to its readable words, for the search index.
   *
   * Cheerio rather than a tag-stripping regex: post bodies are the original
   * WordPress HTML, so they carry `srcset` lists, iframe attributes and HTML
   * entities that a regex would either leave behind or mangle. `.text()` sees
   * only text nodes, and decodes entities on the way out.
   */
  eleventyConfig.addFilter("plainText", (html) =>
    cheerio.load(html ?? "", null, false).text().replace(/\s+/g, " ").trim());

  // Newest first — the order the blog loop and the Recent Posts widget use.
  eleventyConfig.addCollection("postsByDate", (collectionApi) =>
    collectionApi.getFilteredByTag("post").sort((a, b) => b.date - a.date));

  // Per-language post lists, newest first. The blog loop paginates over these,
  // so they must be real collections rather than a filter applied in a template.
  for (const lang of ["en", "pl"]) {
    eleventyConfig.addCollection(`posts_${lang}`, (collectionApi) =>
      collectionApi
        .getFilteredByTag("post")
        .filter((post) => post.data.lang === lang)
        .sort((a, b) => b.date - a.date));
  }

  /**
   * Every archive page on the site: month, category and tag, in both languages.
   *
   * WordPress paginated archives at ten posts per page, so a term with more than
   * ten posts becomes several pages (/category/crafting-tutorial-en/page/2/).
   * Eleventy cannot paginate within a pagination, so the chunking is done here
   * and each entry represents one finished page, carrying the sibling links it
   * needs to render its own pagination.
   *
   * Category nesting needs no special handling: every post in a child category
   * is also explicitly assigned to its parent, which is why the parent archives
   * here hold the same posts the live WordPress site shows.
   */
  eleventyConfig.addCollection("archives", (collectionApi) => {
    const posts = collectionApi
      .getFilteredByTag("post")
      .sort((a, b) => b.date - a.date);

    /** term url -> the archive it will become */
    const terms = new Map();
    const term = (url, fields) => {
      if (!terms.has(url)) terms.set(url, { url, posts: [], ...fields });
      return terms.get(url);
    };

    for (const post of posts) {
      const lang = post.data.lang;

      const monthUrl = [
        lang === "pl" ? "/pl" : "",
        post.date.getUTCFullYear(),
        String(post.date.getUTCMonth() + 1).padStart(2, "0"),
        "",
      ].join("/");
      term(monthUrl, {
        kind: "month",
        lang,
        name: monthLabel(post.date, lang),
        bodyClass: "archive date",
      }).posts.push(post);

      for (const [kind, field] of [["category", "categories"], ["tag", "postTags"]]) {
        for (const item of post.data[field] ?? []) {
          const slug = item.url.replace(/\/$/, "").split("/").pop();
          term(item.url, {
            kind,
            lang,
            name: item.name,
            bodyClass: `archive ${kind} ${kind}-${slug}`,
          }).posts.push(post);
        }
      }
    }

    const PER_PAGE = 10;
    const pages = [];
    for (const archive of terms.values()) {
      const total = Math.max(1, Math.ceil(archive.posts.length / PER_PAGE));
      const hrefs = Array.from({ length: total }, (_, i) =>
        i === 0 ? archive.url : `${archive.url}page/${i + 1}/`);

      for (let i = 0; i < total; i += 1) {
        pages.push({
          ...archive,
          posts: archive.posts.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
          pageNumber: i,
          hrefs,
          permalink: hrefs[i],
        });
      }
    }
    return pages;
  });

  return {
    pathPrefix: PATH_PREFIX,
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    // `11ty.js` is for the search index, which is built as JavaScript so that
    // JSON.stringify handles the escaping rather than a template.
    templateFormats: ["njk", "md", "html", "11ty.js"],
  };
}
