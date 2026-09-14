# vangmar.pl

Static rebuild of the Vangmar.pl WordPress blog (English + Polish), built with
[Eleventy](https://www.11ty.dev/) and published to GitHub Pages.

## The one rule: URLs never change

The blog's addresses are linked from Facebook, Pinterest and YouTube
descriptions, so every URL WordPress served must keep working:

| Kind               | Example                                       |
| ------------------ | --------------------------------------------- |
| English post       | `/leaf-creatures/`                            |
| Polish post        | `/pl/lisciaki/`                                |
| Language homes     | `/` and `/pl/`, paged at `/page/2/`            |
| Month archives     | `/2023/11/` and `/pl/2025/06/`                 |
| Category archives  | `/category/icrpg/icrpg-intro-en/`              |
| Tag archives       | `/tag/crafting-tutorial/`, `/pl/tag/tutorial/` |
| Gallery attachment | `/forests-of-gajen/20231029_100415/`           |
| Media              | `/wp-content/uploads/2025/06/…`                |

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

## The migration from WordPress

All 46 posts have been imported. The original export lives in
`_import/static-export/` and is **not** committed — it is 586 MB, mostly legacy
media. Keep a local copy if you need to re-run the import.

`tools/migration-manifest.json` is the record of what the WordPress site
contained: every post's permalink, publish instant and EN/PL pairing. It is what
the import is driven from, and re-running is safe and idempotent:

```bash
node tools/import-all.mjs      # rewrite all post files from the export
npm run build
node tools/sync-media.mjs      # fetch any uploads the build references
npm run build                  # pick up the new files
```

To import a single post by hand:

```bash
node tools/import-post.mjs _import/static-export/<slug>/index.html \
  --date=2023-11-01T12:00:00Z --key=<shared-translation-key>
```

Publish timestamps come from the live WordPress REST API, which is still up —
use the `date_gmt` value with a `Z` suffix:

```
https://vangmar.pl/wp-json/wp/v2/posts?slug=<slug>&_fields=slug,date_gmt,link
```

### Notes on how the import behaves

Post bodies are kept as the original HTML rather than converted to Markdown:
they contain galleries, `srcset` attributes and embeds whose exact rendering is
the thing being preserved. New posts can be plain Markdown — Eleventy renders
both.

Same-site URLs are rewritten to root-relative paths **in attributes only**. Two
posts print the full address of the Polish quick-start PDF as a link's visible
text, and the reader should still see the address that was written.

`tools/sync-media.mjs` reads the generated HTML in `_site/` rather than the post
sources, because posts are not the only thing referencing media — the gallery
attachment pages pull in thumbnail sizes of their own. Anything the export
lacks is downloaded from the live site; **that only works while the old server
is up.** The 2019 wallpapers and the Polish quick-start PDF were missing from
the export entirely and were recovered this way.

## Layout

```
src/
  _data/          site settings, per-language chrome (i18n.mjs), attachments.json
  _includes/      base, post, home and archive layouts, plus partials
  assets/         vendored Author theme CSS, Font Awesome subset, menu script
  posts/en|pl/    46 posts
  wp-content/     media, at its original WordPress paths
  index.njk       English blog loop   pl/index.njk    Polish blog loop
  search.njk      English search page pl/search.njk   Polish search page
  search-index.11ty.js  the two search indexes, as JSON
  archive.njk     month, category and tag archives
  attachment.njk  gallery attachment pages
  sitemap.njk     sitemap.xml
tools/
  migration-manifest.json  permalinks, publish instants and EN/PL pairings
  import-all.mjs           imports every post in the manifest
  import-post.mjs          converts one exported page (also a module)
  sync-media.mjs           resolves media the built site references
_import/          the WordPress export (git-ignored, local only)
```

## Archives

Month, category and tag archives all come from one `archives` collection in
`eleventy.config.mjs`, rendered by `src/archive.njk`. The collection chunks each
term into the ten-posts-per-page WordPress used, because Eleventy cannot
paginate inside a pagination — one entry is one finished page, carrying the
sibling links it needs.

Nested categories need no special handling: every post in a child category is
*also* explicitly assigned to its parent, so listing posts by direct assignment
reproduces the counts the live site shows.

All 19 categories and 122 tags are generated and were checked page by page
against the live site — entry counts, `<title>` and archive heading all match.

Six categories exist in WordPress with no posts (`/category/basics/`,
`/category/burza/`, `/category/crafting-tutorial/`, `/category/minis/`,
`/category/room-design/`, `/category/wladca-snow/`). They are not generated:
they have no content and nothing links to them, and WordPress is itself
inconsistent about them — some return an empty archive, others already 404.

One cosmetic difference remains, on `/tag/players-card/`. WordPress renders that
tag as `player's card` in a post's tag list but `player’s card` (curly
apostrophe) in the archive heading, because only the heading goes through
`wptexturize`. The rebuild uses the straight apostrophe consistently in both
places.

## Search

The sidebar search widget is back, between *Recent Posts* and *Archives* where
WordPress had it, and results are rendered on the client.

| URL                     | What it searches                           |
| ----------------------- | ------------------------------------------ |
| `/search/?s=term`       | the English posts                           |
| `/pl/search/?s=term`    | the Polish posts                            |
| `/?s=term`, `/pl/?s=term` | the WordPress addresses; they redirect to the above |

Scoping the two languages separately is what Polylang did — `/?s=x` and
`/pl/?s=x` returned different result sets — and it means a reader downloads only
their own language's index.

**There is no search library.** All 46 posts together hold about 45 KB of
readable text; the bodies are mostly gallery and `<iframe>` markup rather than
prose. So `src/search-index.11ty.js` ships the text itself as
`/search-index-en.json` and `/search-index-pl.json` (about 29 KB and 38 KB), and
`src/assets/js/search.js` scans it with `indexOf`. That is roughly what
WordPress did — `LIKE '%term%'` across title, excerpt and content, with AND
between the terms — so there is no stemming and no fuzzy matching: `swiatla`
finds `światła`, but `światło` finds neither, because the word never appears in
that form.

Queries are folded to compare case- and accent-insensitively. The fold is
length-preserving, because match positions in the folded text are used to slice
and highlight the original, and it special-cases `ł`, the one Polish letter
whose stroke is part of the letter rather than a combining mark that
`normalize("NFD")` can strip.

Hits are ranked by where the terms appear — title 8, categories and tags 4,
description 2, body 1 — with ties broken by publish date, and shown as an
excerpt around the first match. Results are rendered in the same markup
`partials/post-loop.njk` emits for a post, so the Author theme's existing
`.search` styles apply with almost no additions; `mark` and the result count are
the only new rules in `assets/css/vangmar.css`.

The form is a plain `GET` and needs no JavaScript to submit — it lands on the
search page, which reads the term back out of the URL. Rendering the results
does need JavaScript, and the page says so in a `<noscript>`. Search pages carry
`noindex, follow`.

The widget's own strings ("Search", "Go") are English on the Polish pages,
because that is what the export shows WordPress serving there; the results page
is new, and its strings follow the same convention. They live in
`src/_data/i18n.mjs` alongside the other theme strings if that is ever revisited.

## Search engine indexing

**The live WordPress site sends `noindex, nofollow` on every page**, which is
the "Discourage search engines from indexing this site" setting left switched
on. This rebuild does not emit that tag, so the new site is indexable. If that
is not wanted, add the meta tag back in `src/_includes/layouts/base.njk`.

## What the rebuild deliberately drops

These were WordPress-only features with no static equivalent:

- **Hubbub share bar** and the *Meta* widget (`wp-login.php`, comment feeds).
- **Comments**, which were not in use.
- **jQuery and the theme's JS bundle**, replaced by `assets/js/navigation.js`
  for the mobile menu and a CSS `aspect-ratio` rule for responsive embeds.

The Polish pages render the theme's own strings ("Published on", "Previous
Post") in English. That is not a bug in the rebuild — Polylang only translated
content, so the live WordPress site does the same, and it is reproduced here to
keep the migration like-for-like.

Two further deliberate omissions:

- **`/sample-page/`** is not migrated. It is the stock WordPress placeholder
  ("I'm a bike messenger by day…"), and it links to a dead admin panel.
- **Gallery attachment pages** are generated only for the eight images the
  Forests of Gajen gallery actually links to. WordPress also chained every
  attachment to the next with Previous/Next Image links, reaching images that
  appear nowhere on the site; recreating that chain would pull in a long tail of
  pages nothing points at.

### Four posts WordPress never paired

`beholder-painting`, `doorway`, `go-out-of-the-bushes` and `icrpg-hero-cards`
each have an obvious Polish counterpart (`malowanie-beholdera`, `drzwi`,
`wylaz-z-krzakow`, `icrpg-karty-postaci`), but Polylang had no translation
registered for them, so their language switcher points at the Polish home page
instead of the matching post. That behaviour is reproduced as-is rather than
quietly corrected.

To link any of these pairs, give both post files the same `translationKey` — the
switcher and `hreflang` tags follow automatically.
