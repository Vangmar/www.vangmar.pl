// Per-language chrome: locale codes, primary menu and widget labels.
//
// The Polish pages of the WordPress site rendered the Author theme's own
// strings ("Published on", "Previous Post", …) untranslated, because only the
// content was run through Polylang. Those strings are reproduced here exactly
// as the live site serves them rather than silently corrected, so the rebuild
// is a like-for-like replacement.
const themeStrings = {
  publishedOn: "Published on",
  publishedIn: "Published in",
  previousPost: "Previous Post",
  nextPost: "Next Post",
  noNewerPosts: "No Newer Posts",
  noOlderPosts: "No Older Posts",
  returnToBlog: "Return to Blog",
  skipToContent: "Skip to content",
  openPrimaryMenu: "open primary menu",
  sidebar: "Sidebar",
  viewAllPostsIn: "View all posts in",
  viewAllPostsTagged: "View all posts tagged",
  // Search. The widget's own strings are the ones the export shows WordPress
  // serving on *both* languages — the Polish home page also rendered "Search"
  // and "Go", because the widget is theme chrome and Polylang only translated
  // content. The results page is new (WordPress rendered search server-side, so
  // the export captured no such page), and its strings sit here for the same
  // reason: a Polish page reading "Wyniki wyszukiwania" directly above
  // "Published on" would be less coherent than one that stays in English
  // throughout. Moving them into the per-language blocks below is a small
  // change if that is ever wanted.
  search: "Search",
  searchGo: "Go",
  searchFor: "Search for:",
  searchResultsFor: "Search Results for:",
  searchPrompt: "Type something to search for.",
  searchNoResults: "Nothing found. Try a different search:",
  searchNeedsJs: "Search needs JavaScript, which is switched off.",
  searchOneResult: "1 result",
  searchManyResults: "% results",
};

export default {
  en: {
    code: "en",
    htmlLang: "en-GB",
    ogLocale: "en_GB",
    home: "/",
    searchUrl: "/search/",
    recentPosts: "Recent Posts",
    archives: "Archives",
    postsHeading: "Vangmar.pl Posts",
    // Archive headings and the paged-title suffix. Polylang did translate these
    // three, unlike the theme strings above — "Tag" is simply the same word in
    // Polish, not an untranslated string.
    pageWord: "Page",
    archiveLabel: { category: "Category", tag: "Tag", month: "Month" },
    menu: [
      { label: "Home", url: "/" },
      { label: "Forests of Gajen", url: "/category/forests-of-gajen/" },
      { label: "ICRPG Intro", url: "/category/icrpg/icrpg-intro-en/" },
      { label: "Crafting", url: "/category/crafting-tutorial-en/" },
    ],
    ...themeStrings,
  },
  pl: {
    code: "pl",
    htmlLang: "pl-PL",
    ogLocale: "pl_PL",
    home: "/pl/",
    searchUrl: "/pl/search/",
    recentPosts: "Ostatnie wpisy",
    archives: "Archiwa",
    postsHeading: "Vangmar.pl Posts",
    pageWord: "Strona",
    archiveLabel: { category: "Kategoria", tag: "Tag", month: "Miesiąc" },
    menu: [
      { label: "Vangmar.pl", url: "/pl/" },
      { label: "Burza", url: "/pl/category/burza-pl/" },
      { label: "Lasy Gajen", url: "/pl/category/lasy-gajen/" },
      { label: "ICRPG Intro", url: "/pl/category/icrpg-pl/icrpg-intro/" },
      { label: "Crafting", url: "/pl/category/tutoriale/" },
    ],
    ...themeStrings,
  },
};
