// The client-side search index: /search-index-en.json and /search-index-pl.json.
//
// Built as JavaScript rather than a Nunjucks template so that JSON.stringify
// does the escaping. Post bodies are raw WordPress HTML full of quotes and
// entities, and hand-escaping that into a template would be a standing bug.
//
// One file per language, because search is scoped per language the way Polylang
// scoped it — a reader on /pl/search/ never needs the English text, so they
// never download it. Both files together are about 50 KB uncompressed.
//
// Keys are single letters: they repeat once per post, and this is the one file
// on the site whose transfer size is worth a little unreadability.

/** Every field the client matches against, in the order it weights them. */
function entry(post, ctx) {
  const terms = [...(post.data.categories ?? []), ...(post.data.postTags ?? [])]
    .map((item) => item.name)
    .join(" ");

  return {
    // Post and month-archive URLs are rendered into HTML by the client, so
    // HtmlBasePlugin never sees them — they need the path prefix applied here.
    u: ctx.url(post.url),
    t: post.data.title,
    // Preformatted, so the client needs no date logic to reproduce the
    // `.post-meta` line that partials/post-loop.njk renders.
    p: ctx.postDate(post.date, post.data.lang),
    m: ctx.url(ctx.monthUrl(post.date, post.data.lang)),
    d: post.date.toISOString(),
    s: post.data.description ?? "",
    c: terms,
    x: ctx.plainText(post.templateContent),
  };
}

export default class {
  data() {
    return {
      pagination: { data: "langs", size: 1, alias: "lang" },
      langs: ["en", "pl"],
      permalink: (data) => `/search-index-${data.lang}.json`,
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const posts = data.collections[`posts_${data.lang}`];
    return JSON.stringify(posts.map((post) => entry(post, this)));
  }
}
