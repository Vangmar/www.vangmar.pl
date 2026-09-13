// Eleventy configuration for Vangmar.pl
//
// The hard requirement of this site is URL preservation: every address the
// WordPress blog served must keep working, because they are linked from social
// media. Post URLs are therefore never derived from file paths — each post
// declares its exact legacy address in a `permalink:` front matter field.

import { HtmlBasePlugin } from "@11ty/eleventy";

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

  // "November 2023" / "czerwiec 2025" — archive widget labels.
  eleventyConfig.addFilter("monthLabel", (date, lang = "en") => {
    const { year, month } = dateParts(date);
    const months = lang === "pl" ? PL_MONTHS : EN_MONTHS;
    return `${months[month]} ${year}`;
  });

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

  // Newest first — the order the blog loop and the Recent Posts widget use.
  eleventyConfig.addCollection("postsByDate", (collectionApi) =>
    collectionApi.getFilteredByTag("post").sort((a, b) => b.date - a.date));

  /**
   * One entry per (language, month) that has posts, newest first, for the
   * WordPress month archives at /2023/11/ and /pl/2025/06/.
   */
  eleventyConfig.addCollection("dateArchives", (collectionApi) => {
    const posts = collectionApi
      .getFilteredByTag("post")
      .sort((a, b) => b.date - a.date);

    const groups = new Map();
    for (const post of posts) {
      const key = [
        post.data.lang,
        post.date.getUTCFullYear(),
        post.date.getUTCMonth(),
      ].join("-");
      if (!groups.has(key)) {
        groups.set(key, { lang: post.data.lang, date: post.date, posts: [] });
      }
      groups.get(key).posts.push(post);
    }
    return [...groups.values()];
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
    templateFormats: ["njk", "md", "html"],
  };
}
