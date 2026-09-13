#!/usr/bin/env node
/**
 * Imports one post from the archived WordPress export into src/posts/.
 *
 *   node tools/import-post.mjs <path-to-exported-index.html> [--lang en|pl]
 *
 * The export under _import/static-export/ is machine-generated WordPress output,
 * so the markup is uniform enough to read structurally with cheerio. The script
 * lifts the pieces the Eleventy templates need — title, dates, excerpt, featured
 * image, body, taxonomy — rewrites absolute https://vangmar.pl/ references to
 * root-relative paths, and writes a front-mattered Markdown file.
 *
 * Post bodies are kept as the original HTML rather than converted to Markdown.
 * They contain galleries, srcset attributes and iframes whose exact rendering is
 * the thing we are preserving; Markdown round-tripping would quietly change it.
 * New posts can still be written as ordinary Markdown — Eleventy renders both.
 *
 * Images are NOT copied: the script prints the uploads each post needs, so they
 * can be added deliberately instead of dragging in all 576 MB of legacy media.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { load } from "cheerio";

const SITE = "https://vangmar.pl";
const REPO = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");

/** Strip the site origin so links become root-relative and portable. */
const relative = (url = "") =>
  url.replace(/^https?:\/\/(?:www\.)?vangmar\.pl/, "") || "/";

/** Rewrite every absolute same-site reference inside a block of HTML. */
const rewrite = (html) =>
  html
    .replace(/https?:\/\/(?:www\.)?vangmar\.pl\//g, "/")
    .replace(/\s*\?ver=[\w.]+/g, "");

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

/**
 * Quote a value as a YAML double-quoted scalar. YAML's double-quoted style uses
 * JSON's escaping rules, so JSON.stringify is exactly right here and covers
 * quotes, backslashes and newlines without hand-rolled escaping.
 */
function quote(value) {
  return JSON.stringify(String(value));
}

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
if (!source) {
  fail(
    "usage: node tools/import-post.mjs <exported index.html> " +
      "[--lang en|pl] [--date=<ISO date_gmt, e.g. 2023-11-17T17:23:04Z>] [--key=<translation key>]",
  );
}
if (!existsSync(source)) fail(`no such file: ${source}`);

const $ = load(readFileSync(source, "utf8"));

const canonical = relative($('link[rel="canonical"]').attr("href") ?? "");
if (!canonical.endsWith("/")) fail(`could not read a canonical URL from ${source}`);

// Language comes from the URL prefix, which is how Polylang laid the site out.
const langFlag = args.find((a) => a.startsWith("--lang="));
const lang = langFlag ? langFlag.split("=")[1] : canonical.startsWith("/pl/") ? "pl" : "en";
if (lang !== "en" && lang !== "pl") fail(`unsupported language: ${lang}`);

const slug = canonical.replace(/^\/(pl\/)?/, "").replace(/\/$/, "");
const title = $(".post-title").first().text().trim();
if (!title) fail("could not find a .post-title");

// The export carries no machine-readable publish date — only the theme's
// formatted "1st November 2023" string — so the real timestamp is passed in from
// the REST API's `date_gmt` via --date. Across all 46 posts the Warsaw-local day
// and the UTC day are identical, so storing the UTC instant renders the same day
// WordPress displayed while also preserving ordering within a day.
const displayed = $(".post-meta .date").first().text().trim();
const dateFlag = args.find((a) => a.startsWith("--date="))?.split("=").slice(1).join("=");

// EN and PL counterparts have unrelated slugs (leaf-creatures / lisciaki), so the
// pairing key cannot be derived — it is supplied with --key and shared by both.
const keyFlag = args.find((a) => a.startsWith("--key="))?.split("=")[1];

const description = $('meta[property="og:description"]').attr("content")?.trim() ?? "";

const featured = $(".featured-image img").first();
const body = $(".post-content").first();
if (!body.length) fail("could not find a .post-content");

const categories = $(".post-categories a")
  .map((_, el) => ({ name: $(el).text().trim(), url: relative($(el).attr("href")) }))
  .get();

const postTags = $(".post-tags a")
  .map((_, el) => ({ name: $(el).text().trim(), url: relative($(el).attr("href")) }))
  .get();

const front = [
  "---",
  `title: ${quote(title)}`,
  `permalink: ${quote(canonical)}`,
  `date: ${quote(dateFlag ?? "TODO-SET-PUBLISH-DATE")}`,
  `translationKey: ${quote(keyFlag ?? slug)}`,
];
if (description) front.push(`description: ${quote(description)}`);

if (featured.length) {
  front.push(`image: ${quote(relative(featured.attr("src")))}`);
  if (featured.attr("alt")) front.push(`imageAlt: ${quote(featured.attr("alt"))}`);
  if (featured.attr("width")) front.push(`imageWidth: ${featured.attr("width")}`);
  if (featured.attr("height")) front.push(`imageHeight: ${featured.attr("height")}`);
  if (featured.attr("srcset")) front.push(`imageSrcset: ${quote(rewrite(featured.attr("srcset")))}`);
}

const list = (name, items) => {
  if (!items.length) return;
  front.push(`${name}:`);
  for (const item of items) front.push(`  - { name: ${quote(item.name)}, url: ${quote(item.url)} }`);
};
list("categories", categories);
list("postTags", postTags);
front.push("---", "");

const html = rewrite(body.html() ?? "").trim();
const out = join(REPO, "src", "posts", lang, `${slug}.md`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${front.join("\n")}\n${html}\n`, "utf8");

const uploads = [...new Set(
  [...(body.html() ?? ""), ...(featured.attr("srcset") ?? ""), ...(featured.attr("src") ?? "")]
    .join("")
    .match(/\/wp-content\/uploads\/[^"'\s)]+/g) ?? []
)];

console.log(`wrote ${out.replace(REPO, ".")}`);
console.log(`  lang=${lang}  permalink=${canonical}  displayed date="${displayed}"`);
if (!dateFlag) {
  console.log(
    `  WARNING: no --date given; set 'date:' by hand from ` +
      `${SITE}/wp-json/wp/v2/posts?slug=${slug} (use the date_gmt value, suffixed with Z)`,
  );
}
if (uploads.length) {
  console.log(`  uploads referenced (${uploads.length}) — copy these into src/wp-content/:`);
  for (const u of uploads) console.log(`    ${u}`);
}
