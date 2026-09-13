// Mobile primary-menu toggle.
//
// Replaces the Author theme's jQuery bundle: the only behaviour the static site
// needs is toggling `.open` on #main-sidebar, which is what the theme's own
// stylesheet keys its responsive menu, sidebar and social-icon rules off.
(function () {
  "use strict";

  var toggle = document.getElementById("toggle-navigation");
  var sidebar = document.getElementById("main-sidebar");
  if (!toggle || !sidebar) return;

  var label = toggle.querySelector("span");
  var labels = {
    open: label ? label.textContent : "",
    close: document.documentElement.lang.indexOf("pl") === 0
      ? "zamknij menu główne"
      : "close primary menu",
  };

  toggle.addEventListener("click", function () {
    var isOpen = sidebar.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (label) label.textContent = isOpen ? labels.close : labels.open;
  });
})();
