# vangmar.pl

Static rebuild of the Vangmar.pl WordPress blog (English + Polish), built with
[Eleventy](https://www.11ty.dev/) and published to GitHub Pages.

## The one rule: URLs never change

The blog's addresses are linked from Facebook, Pinterest and YouTube
descriptions, so every URL WordPress served must keep working:

| Kind            | Example                            |
| --------------- | ---------------------------------- |
| English post    | `/leaf-creatures/`                 |
| Polish post     | `/pl/lisciaki/`                     |
| Language homes  | `/` and `/pl/`                      |
| Month archives  | `/2023/11/` and `/pl/2025/06/`      |
| Media           | `/wp-content/uploads/2025/06/…`     |

Post addresses are therefore **never derived from file names**. Each post states
its exact address in a `permalink:` field, and media keeps its original
`/wp-content/uploads/…` path so image links shared to social sites still resolve.

The canonical domain is the apex, `vangmar.pl` — that is what every existing link
uses, and `www.vangmar.pl` has always redirected to it. `src/CNAME` reflects that.

## Working on the site

```bash
npm install
npm run serve    # http://localhost:8080, rebuilds as you edit
npm run build    # writes _site/
```

Every push to `main` builds and deploys through
`.github/workflows/deploy.yml`.

### Where the site is served from

Until the custom domain is live, GitHub serves this repository as a *project*
site under its own name — `https://vangmar.github.io/www.vangmar.pl/` — not at a
domain root. Root-relative paths like `/assets/css/author.css` would 404 there,
so the build takes a `PATH_PREFIX` environment variable:

```bash
PATH_PREFIX=/www.vangmar.pl/ npm run build   # github.io preview
npm run build                                # the real domain (default "/")
```

`PATH_PREFIX` only rewrites generated links; it never changes the output file
layout, so the preserved permalinks are identical either way.

`.github/workflows/deploy.yml` sets it in one place, at the top of the file. It
also controls whether `CNAME` ships: GitHub reads that file from the deployed
artifact and switches the site to the custom domain, which during preview would
redirect to a domain whose DNS still points at the old WordPress host. The two
settings therefore move together and cannot disagree.

### Going live on vangmar.pl

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Check the deployed preview at `https://vangmar.github.io/www.vangmar.pl/`.
3. Point DNS at GitHub Pages — apex `A`/`AAAA` records to GitHub's Pages
   addresses, plus a `www` `CNAME` to `vangmar.github.io` so that
   `www.vangmar.pl` keeps redirecting to the apex.
4. **Set `PATH_PREFIX` to `"/"` in `.github/workflows/deploy.yml`** and push.
   This is the cutover: it restores root-relative links and ships `CNAME`.
5. **Settings → Pages → Custom domain: `vangmar.pl`**, then enable
   *Enforce HTTPS* once the certificate is issued.

Do the DNS change **before** step 4 but after step 2 — nothing about the live
blog changes until DNS moves, so there is no window where it is down.

## Adding a post

New posts are ordinary Markdown in `src/posts/en/` or `src/posts/pl/`:

```markdown
---
title: "Post title"
permalink: "/post-slug/"
date: "2026-01-15T09:00:00Z"
translationKey: "post-slug"
description: "Shown in search results and social previews."
categories:
  - { name: "Crafting tutorial", url: "/category/crafting-tutorial-en/" }
---

Body text, as Markdown.
```

`translationKey` is what pairs an English post with its Polish counterpart —
give both files the same key and the language switcher and `hreflang` tags wire
themselves up. A post with no counterpart (such as `/pl/burza/`) simply omits a
matching partner, and the switcher falls back to the other language's home page.

`date` is the UTC publish instant. It controls ordering as well as the displayed
date, so posts published on the same day keep their original sequence.

## Importing the remaining WordPress posts

The original WordPress export lives in `_import/static-export/` and is **not**
committed — it is 586 MB, mostly legacy media. Keep a local copy to import from.

```bash
node tools/import-post.mjs _import/static-export/<slug>/index.html \
  --date=2023-11-01T12:00:00Z --key=<shared-translation-key>
```

The script reads the archived page, rewrites absolute `https://vangmar.pl/`
references to root-relative paths, and writes a front-mattered Markdown file. It
does not copy images — it prints the uploads the post needs, so media is added
deliberately rather than dragging in all 576 MB at once.

Publish timestamps come from the live WordPress REST API, which is still up:

```
https://vangmar.pl/wp-json/wp/v2/posts?slug=<slug>&_fields=slug,date_gmt,link
```

Use the `date_gmt` value with a `Z` suffix.

Post bodies are kept as the original HTML rather than converted to Markdown:
they contain galleries, `srcset` attributes and embeds whose exact rendering is
the thing being preserved. New posts can be plain Markdown — Eleventy renders
both.

## Layout

```
src/
  _data/          site settings (site.mjs) and per-language chrome (i18n.mjs)
  _includes/      base, post, home and archive layouts, plus header/sidebar/footer
  assets/         vendored Author theme CSS, Font Awesome subset, menu script
  posts/en|pl/    post content
  wp-content/     media, at its original WordPress paths
  index.njk       English home        pl/index.njk   Polish home
  date-archive.njk  month archives    sitemap.njk    sitemap.xml
tools/            import-post.mjs — WordPress export importer
_import/          the WordPress export (git-ignored, local only)
```

## What the rebuild deliberately drops

These were WordPress-only features with no static equivalent:

- **Search widget** — needs a server. A client-side index can be added later.
- **Hubbub share bar** and the *Meta* widget (`wp-login.php`, comment feeds).
- **Comments**, which were not in use.
- **jQuery and the theme's JS bundle**, replaced by `assets/js/navigation.js`
  for the mobile menu and a CSS `aspect-ratio` rule for responsive embeds.

The Polish pages render the theme's own strings ("Published on", "Previous
Post") in English. That is not a bug in the rebuild — Polylang only translated
content, so the live WordPress site does the same, and it is reproduced here to
keep the migration like-for-like.
