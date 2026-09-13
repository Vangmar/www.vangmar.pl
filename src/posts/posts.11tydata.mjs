// Shared settings for every post, in both languages.
export default {
  layout: "layouts/post.njk",
  // Collection name used by the blog loop, sidebar and adjacent-post links.
  tags: ["post"],

  eleventyComputed: {
    /**
     * The same post in the other language, matched on `translationKey`.
     * Drives the language switcher and the hreflang pair, the way Polylang did.
     * Posts with no counterpart (e.g. /pl/burza/) resolve to null, and the
     * switcher falls back to the other language's home page.
     */
    translation: (data) => {
      const posts = data.collections?.post;
      if (!data.translationKey || !posts) return null;
      const other = posts.find(
        (post) =>
          post.data.translationKey === data.translationKey &&
          post.data.lang !== data.lang,
      );
      return other
        ? { url: other.url, lang: other.data.lang, title: other.data.title }
        : null;
    },
  },

  /**
   * The body classes WordPress emitted on a single post. The theme's stylesheet
   * keys real rules off `single`, `singular` and `full-post`, so these are load
   * bearing rather than decorative. `has-grow-sidebar` is omitted: it belonged to
   * the Hubbub share plugin, whose stylesheet this rebuild does not ship.
   */
  bodyClass: [
    "wp-singular",
    "post-template-default",
    "single",
    "single-post",
    "single-format-standard",
    "wp-theme-author",
    "full-post",
    "singular",
    "singular-post",
  ].join(" "),
};
