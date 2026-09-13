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
};

export default {
  en: {
    code: "en",
    htmlLang: "en-GB",
    ogLocale: "en_GB",
    home: "/",
    recentPosts: "Recent Posts",
    archives: "Archives",
    postsHeading: "Vangmar.pl Posts",
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
    recentPosts: "Ostatnie wpisy",
    archives: "Archiwa",
    postsHeading: "Vangmar.pl Posts",
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
