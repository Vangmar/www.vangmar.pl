#!/usr/bin/env node
/**
 * Imports one post from the archived WordPress export into src/posts/.
 *
 *   node tools/import-post.mjs <path-to-exported-index.html> \
 *     [--lang en|pl] [--date=<ISO date_gmt>] [--key=<translation key>]
 *
 * Also usable as a module — `tools/import-all.mjs` drives it over the whole
 * migration manifest.
 *
 * The export under _import/static-export/ is machine-generated WordPress output,
 * so the markup is uniform enough to read structurally with cheerio. This lifts
 * the pieces the Eleventy templates need — title, excerpt, featured image, body,
 * taxonomy — rewrites absolute https://vangmar.pl/ references to root-relative
 * paths, and writes a front-mattered Markdown file.
 *
 * Post bodies are kept as the original HTML rather than converted to Markdown.
 * They contain galleries, srcset attributes and iframes whose exact rendering is
 * the thing being preserved; Markdown round-tripping would quietly change it.
 * New posts can still be written as ordinary Markdown — Eleventy renders both.
 *
 * Images are not copied here; the caller is told which uploads a post needs.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

export const SITE = "https://vangmar.pl";
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Strip the site origin so links become root-relative and portable. */
const relative = (url = "") =>
  url.replace(/^https?:\/\/(?:www\.)?vangmar\.pl/, "") || "/";

/** Rewrite every absolute same-site reference inside a block of HTML. */
const rewrite = (html = "") =>
  html
    .replace(/https?:\/\/(?:www\.)?vangmar\.pl\//g, "/")
    .replace(/\s*\?ver=[\w.]+/g, "");

/**
 * Quote a value as a YAML double-quoted scalar. YAML's double-quoted style uses
 * JSON's escaping rules, so JSON.stringify is exactly right here and covers
 * quotes, backslashes and newlines without hand-rolled escaping.
 */
const quote = (value) => JSON.stringify(String(value));

/**
 * Convert one exported page into a post file.
 *
 * @param {object} options
 * @param {string} options.source        path to the exported index.html
 * @param {string} [options.lang]        "en" | "pl"; inferred from the URL otherwise
 * @param {string} [options.date]        ISO publish instant (WordPress `date_gmt` + "Z")
 * @param {string} [options.translationKey]  shared by a post and its counterpart
 * @returns {{outPath: string, permalink: string, lang: string, title: string,
 *            uploads: string[], displayed: string, hasDate: boolean}}
 */
export function importPost({ source, lang, date, translationKey }) {
  if (!existsSync(source)) throw new Error(`no such file: ${source}`);

  const $ = load(readFileSync(source, "utf8"));

  const permalink = relative($('link[rel="canonical"]').attr("href") ?? "");
  if (!permalink.endsWith("/")) {
    throw new Error(`could not read a canonical URL from ${source}`);
  }

  // Language follows the URL prefix, which is how Polylang laid the site out.
  const language = lang ?? (permalink.startsWith("/pl/") ? "pl" : "en");
  if (language !== "en" && language !== "pl") {
    throw new Error(`unsupported language: ${language}`);
  }

  const slug = permalink.replace(/^\/(pl\/)?/, "").replace(/\/$/, "");
  const title = $(".post-title").first().text().trim();
  if (!title) throw new Error(`could not find a .post-title in ${source}`);

  const body = $(".post-content").first();
  if (!body.length) throw new Error(`could not find a .post-content in ${source}`);

  // The export carries no machine-readable date, only the theme's formatted
  // "1st November 2023" string, so the real instant is passed in from the REST
  // API. Across all 46 posts the Warsaw-local day matches the UTC day, so the
  // UTC instant renders the day WordPress displayed while also keeping posts
  // published on the same day in their original order.
  const displayed = $(".post-meta .date").first().text().trim();

  const description = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
  const featured = $(".featured-image img").first();

  const taxonomy = (selector) =>
    $(selector)
      .map((_, el) => ({ name: $(el).text().trim(), url: relative($(el).attr("href")) }))
      .get();

  const front = [
    "---",
    `title: ${quote(title)}`,
    `permalink: ${quote(permalink)}`,
    `date: ${quote(date ?? "TODO-SET-PUBLISH-DATE")}`,
    `translationKey: ${quote(translationKey ?? slug)}`,
  ];
  if (description) front.push(`description: ${quote(description)}`);

  if (featured.length) {
    front.push(`image: ${quote(relative(featured.attr("src")))}`);
    if (featured.attr("alt")) front.push(`imageAlt: ${quote(featured.attr("alt"))}`);
    if (featured.attr("width")) front.push(`imageWidth: ${featured.attr("width")}`);
    if (featured.attr("height")) front.push(`imageHeight: ${featured.attr("height")}`);
    if (featured.attr("srcset")) {
      front.push(`imageSrcset: ${quote(rewrite(featured.attr("srcset")))}`);
    }
  }

  for (const [name, items] of [
    ["categories", taxonomy(".post-categories a")],
    ["postTags", taxonomy(".post-tags a")],
  ]) {
    if (!items.length) continue;
    front.push(`${name}:`);
    for (const item of items) {
      front.push(`  - { name: ${quote(item.name)}, url: ${quote(item.url)} }`);
    }
  }
  front.push("---", "");

  /*
   * Rewrite same-site URLs in attributes only.
   *
   * A string replace across the whole block would also rewrite URLs that appear
   * as visible link *text*: two posts print the full address of the Polish
   * quick-start PDF as the link's own text, and the reader should still be shown
   * the address the author wrote, not a root-relative path.
   */
  for (const attribute of ["href", "src", "srcset"]) {
    body.find(`[${attribute}]`).each((_, element) => {
      const node = $(element);
      node.attr(attribute, rewrite(node.attr(attribute)));
    });
  }

  const html = (body.html() ?? "").trim();
  const outPath = join(REPO, "src", "posts", language, `${slug}.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${front.join("\n")}\n${html}\n`, "utf8");

  // Every upload the post depends on: the body, plus the featured image and its
  // responsive variants, which live outside .post-content.
  const searched = [html, rewrite(featured.attr("src")), rewrite(featured.attr("srcset"))]
    .filter(Boolean)
    .join(" ");
  // `<` and `>` must terminate the match: some posts print a bare upload URL as
  // link text, where nothing but the following tag ends the path.
  const uploads = [
    ...new Set(searched.match(/\/wp-content\/uploads\/[^"'\s),<>]+/g) ?? []),
  ].sort();

  return { outPath, permalink, lang: language, title, uploads, displayed, hasDate: Boolean(date) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const flag = (name) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

  const source = args.find((a) => !a.startsWith("--"));
  if (!source) {
    console.error(
      "usage: node tools/import-post.mjs <exported index.html> " +
        "[--lang=en|pl] [--date=<ISO date_gmt, e.g. 2023-11-17T17:23:04Z>] " +
        "[--key=<translation key>]",
    );
    process.exit(1);
  }

  try {
    const result = importPost({
      source,
      lang: flag("lang"),
      date: flag("date"),
      translationKey: flag("key"),
    });
    console.log(`wrote ${result.outPath.replace(REPO, ".")}`);
    console.log(
      `  lang=${result.lang}  permalink=${result.permalink}  ` +
        `displayed date="${result.displayed}"`,
    );
    if (!result.hasDate) {
      console.log(
        `  WARNING: no --date given; set 'date:' by hand from ` +
          `${SITE}/wp-json/wp/v2/posts?slug=${result.permalink.replace(/^\/(pl\/)?|\/$/g, "")} ` +
          `(use the date_gmt value, suffixed with Z)`,
      );
    }
    if (result.uploads.length) {
      console.log(`  uploads referenced (${result.uploads.length}):`);
      for (const u of result.uploads) console.log(`    ${u}`);
    }
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}
