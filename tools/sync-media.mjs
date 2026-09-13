#!/usr/bin/env node
/**
 * Makes sure every upload the built site references is present in src/.
 *
 *   npm run build && node tools/sync-media.mjs [--dry-run]
 *
 * Works from the generated HTML in _site/ rather than from the post sources,
 * because posts are not the only thing that references media — the gallery
 * attachment pages and the taxonomy archives pull in thumbnail sizes of their
 * own. Reading the finished output catches every consumer without this script
 * needing to know which templates exist.
 *
 * Each missing file is taken from the WordPress export when it is there, and
 * otherwise downloaded from the live WordPress site. That fallback only works
 * while the old server is up: the export omitted some uploads entirely (the
 * 2019 wallpapers, the Polish quick-start PDF), and once the server is retired
 * those originals are gone.
 *
 * Re-run after adding templates that introduce new image sizes, then rebuild.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO, SITE } from "./import-post.mjs";

const EXPORT_ROOT = join(REPO, "_import", "static-export");
const OUTPUT = join(REPO, "_site");
const dryRun = process.argv.includes("--dry-run");

if (!existsSync(OUTPUT)) {
  console.error("error: _site/ not found — run `npm run build` first");
  process.exit(1);
}

/** Every /wp-content/uploads/... path referenced by the generated HTML. */
function referenced() {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".html")) {
        const text = readFileSync(path, "utf8");
        // Matching the path fragment rather than a leading slash keeps this
        // correct whether or not the build carried a PATH_PREFIX.
        for (const m of text.match(/\/wp-content\/uploads\/[^"'\s),<>]+/g) ?? []) {
          found.add(m);
        }
      }
    }
  };
  walk(OUTPUT);
  return [...found].sort();
}

const wanted = referenced();
const missing = wanted.filter((u) => !existsSync(join(REPO, "src", u)));

console.log(`referenced by the built site: ${wanted.length} uploads`);
console.log(`already in src/             : ${wanted.length - missing.length}`);
console.log(`to resolve                  : ${missing.length}${dryRun ? "  (dry run)" : ""}\n`);

if (!missing.length) {
  console.log("nothing to do");
  process.exit(0);
}

let fromExport = 0;
let fromLive = 0;
const failed = [];

for (const upload of missing) {
  const to = join(REPO, "src", upload);
  const exported = join(EXPORT_ROOT, upload);

  if (existsSync(exported)) {
    if (!dryRun) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(exported, to);
    }
    fromExport += 1;
    console.log(`  export  ${upload}`);
    continue;
  }

  if (dryRun) {
    console.log(`  fetch   ${upload}`);
    continue;
  }

  try {
    const response = await fetch(SITE + upload, { redirect: "follow" });
    if (!response.ok) {
      failed.push([upload, `HTTP ${response.status}`]);
      console.log(`  FAIL ${response.status}  ${upload}`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, bytes);
    fromLive += 1;
    console.log(`  live    ${(bytes.length / 1024).toFixed(0).padStart(6)} KB  ${upload}`);
  } catch (error) {
    failed.push([upload, error.message]);
    console.log(`  FAIL ${upload}: ${error.message}`);
  }
}

if (!dryRun) {
  const added = missing
    .map((u) => join(REPO, "src", u))
    .filter(existsSync)
    .reduce((n, p) => n + statSync(p).size, 0);
  console.log(
    `\nresolved ${fromExport + fromLive} of ${missing.length} ` +
      `(${fromExport} from the export, ${fromLive} from the live site, ` +
      `${(added / 1048576).toFixed(1)} MB)`,
  );
  if (failed.length) {
    console.log("still missing:");
    for (const [u, why] of failed) console.log(`  ${u}  (${why})`);
    process.exitCode = 1;
  } else {
    console.log("rebuild so the new files are copied into _site/");
  }
}
