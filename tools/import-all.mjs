#!/usr/bin/env node
/**
 * Imports every post in tools/migration-manifest.json, then copies the media
 * those posts reference out of the archived WordPress export.
 *
 *   node tools/import-all.mjs [--dry-run]
 *
 * Re-running is safe: post files are rewritten from the export each time, and
 * media is only copied when it is missing or a different size. The manifest is
 * the record of what the WordPress site contained — permalinks, publish
 * instants and EN/PL pairings — so this is the one place the migration is
 * driven from.
 *
 * Media that the export does not contain is reported rather than silently
 * skipped: a handful of the original uploads never made it into the export and
 * have to be fetched from the live site with tools/fetch-missing-media.mjs.
 */
import { readFileSync, copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { importPost, REPO } from "./import-post.mjs";

const EXPORT_ROOT = join(REPO, "_import", "static-export");
const MANIFEST = join(REPO, "tools", "migration-manifest.json");

const dryRun = process.argv.includes("--dry-run");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
console.log(`manifest: ${manifest.length} posts${dryRun ? "  (dry run)" : ""}\n`);

const imported = [];
const failures = [];
const allUploads = new Set();

for (const entry of manifest) {
  if (!entry.source) {
    failures.push([entry.permalink, "no source page in the export"]);
    continue;
  }
  try {
    const result = importPost({
      source: join(REPO, entry.source),
      lang: entry.lang,
      date: entry.date,
      translationKey: entry.translationKey,
    });
    imported.push(result);
    for (const u of result.uploads) allUploads.add(u);
  } catch (error) {
    failures.push([entry.permalink, error.message]);
  }
}

console.log(`imported ${imported.length} posts, ${failures.length} failed`);
for (const [permalink, reason] of failures) {
  console.log(`  FAILED ${permalink}: ${reason}`);
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
const copied = [];
const skipped = [];
const missing = [];

for (const upload of [...allUploads].sort()) {
  const from = join(EXPORT_ROOT, upload);
  const to = join(REPO, "src", upload);

  if (!existsSync(from)) {
    // Absent from the export, but it may already have been recovered from the
    // live site by tools/fetch-missing-media.mjs — only flag what is truly gone.
    if (existsSync(to)) skipped.push(upload);
    else missing.push(upload);
    continue;
  }
  if (existsSync(to) && statSync(to).size === statSync(from).size) {
    skipped.push(upload);
    continue;
  }
  if (!dryRun) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  copied.push(upload);
}

const mb = (paths, root) =>
  (paths.reduce((n, p) => n + (existsSync(join(root, p)) ? statSync(join(root, p)).size : 0), 0) /
    1048576).toFixed(1);

console.log(`\nmedia referenced by those posts: ${allUploads.size} files`);
console.log(`  copied      ${copied.length}  (${mb(copied, EXPORT_ROOT)} MB)`);
console.log(`  already ok  ${skipped.length}`);
console.log(`  MISSING     ${missing.length}`);

if (missing.length) {
  console.log("\nNot present in the export — fetch from the live site before it goes away:");
  for (const u of missing) console.log(`  ${u}`);
  console.log("\n  node tools/fetch-missing-media.mjs");
}

if (failures.length) process.exitCode = 1;
