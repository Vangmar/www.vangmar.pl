// Client-side search.
//
// Loaded on every page, because it has two jobs. On /search/ and /pl/search/ it
// runs the search. Everywhere else it does nothing unless the URL carries the
// legacy WordPress `?s=` parameter, which it forwards.
//
// There is no search library here on purpose. All 46 posts together hold about
// 45 KB of readable text — the bodies are mostly gallery and iframe markup — so
// the index *is* the text, and matching is a substring scan over it. That is
// also what WordPress itself did: LIKE against title, excerpt and content, with
// AND between the terms. A stemming index would be larger than this whole file
// and less faithful.
(function () {
	"use strict";

	var PARAM = "s";
	var DEBOUNCE_MS = 150;

	// Fields the client matches on, and how much a hit in each is worth.
	var FIELDS = [
		{ key: "t", weight: 8 },   // title
		{ key: "c", weight: 4 },   // categories and tags
		{ key: "s", weight: 2 },   // description
		{ key: "x", weight: 1 },   // body text
	];

	// Past a handful, further repetitions of a word say little more about how
	// relevant a post is, so the count stops being added up.
	var MAX_HITS = 4;

	// Characters either side of a match to show in an excerpt, before it is
	// trimmed back to whole words.
	var LEAD = 130;
	var TRAIL = 210;

	/**
	 * Case- and accent-insensitive text, the same length as what went in.
	 *
	 * Length matters: positions found in the folded text are used to slice and
	 * highlight the original. A plain normalize("NFD") would break that, because
	 * "ą" becomes two code points, so each character is folded on its own and
	 * only kept if it collapsed back to one.
	 *
	 * "ł" is special-cased. It is the one Polish letter whose stroke is part of
	 * the letter rather than a combining mark, so NFD leaves it alone and a
	 * search for "lasy" would otherwise never find "Lasy" spelled with it.
	 */
	function fold(text) {
		var out = "";
		for (var i = 0; i < text.length; i += 1) {
			var lower = text[i].toLowerCase();
			var ch = lower.length === 1 ? lower : text[i];
			if (ch === "ł") {
				out += "l";
				continue;
			}
			var stripped = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
			out += stripped.length === 1 ? stripped : ch;
		}
		return out;
	}

	/** The query as the terms that must all be present. */
	function parse(query) {
		return fold(query).split(/\s+/).filter(Boolean);
	}

	/** Every position of `needle` in `haystack`. */
	function positions(haystack, needle) {
		var found = [];
		var at = haystack.indexOf(needle);
		while (at !== -1) {
			found.push(at);
			at = haystack.indexOf(needle, at + needle.length);
		}
		return found;
	}

	/** Relevance, or 0 when any term is missing entirely. */
	function score(entry, terms) {
		var total = 0;
		for (var i = 0; i < terms.length; i += 1) {
			var here = 0;
			for (var f = 0; f < FIELDS.length; f += 1) {
				var hits = positions(entry.folded[FIELDS[f].key], terms[i]).length;
				if (hits) here += FIELDS[f].weight * Math.min(hits, MAX_HITS);
			}
			if (!here) return 0;
			total += here;
		}
		return total;
	}

	/** Matches ranked by relevance, ties broken by publish date, newest first. */
	function search(entries, terms) {
		var hits = [];
		for (var i = 0; i < entries.length; i += 1) {
			var relevance = score(entries[i], terms);
			if (relevance) hits.push({ entry: entries[i], relevance: relevance });
		}
		hits.sort(function (a, b) {
			if (b.relevance !== a.relevance) return b.relevance - a.relevance;
			return a.entry.d < b.entry.d ? 1 : -1;
		});
		return hits;
	}

	/** Non-overlapping ranges covering every occurrence of every term. */
	function ranges(folded, terms) {
		var found = [];
		for (var i = 0; i < terms.length; i += 1) {
			var at = positions(folded, terms[i]);
			for (var j = 0; j < at.length; j += 1) {
				found.push({ start: at[j], end: at[j] + terms[i].length });
			}
		}
		found.sort(function (a, b) { return a.start - b.start; });

		var merged = [];
		for (var k = 0; k < found.length; k += 1) {
			var last = merged[merged.length - 1];
			if (last && found[k].start <= last.end) {
				last.end = Math.max(last.end, found[k].end);
			} else {
				merged.push(found[k]);
			}
		}
		return merged;
	}

	/**
	 * `text` as nodes, with each match wrapped in <mark>.
	 *
	 * Built out of text nodes rather than an HTML string: the terms come
	 * straight from the URL, and this is the one place they go back into the
	 * page.
	 */
	function highlight(text, folded, terms) {
		var fragment = document.createDocumentFragment();
		var spans = ranges(folded, terms);
		var at = 0;
		for (var i = 0; i < spans.length; i += 1) {
			if (spans[i].start > at) {
				fragment.appendChild(document.createTextNode(text.slice(at, spans[i].start)));
			}
			var mark = document.createElement("mark");
			mark.textContent = text.slice(spans[i].start, spans[i].end);
			fragment.appendChild(mark);
			at = spans[i].end;
		}
		if (at < text.length) fragment.appendChild(document.createTextNode(text.slice(at)));
		return fragment;
	}

	/** A window of body text around the first match, trimmed to whole words. */
	function excerpt(entry, terms) {
		var folded = entry.folded.x;
		var first = -1;
		for (var i = 0; i < terms.length; i += 1) {
			var at = folded.indexOf(terms[i]);
			if (at !== -1 && (first === -1 || at < first)) first = at;
		}
		// Only the title, tags or description matched; open at the beginning.
		if (first === -1) first = 0;

		var start = Math.max(0, first - LEAD);
		var end = Math.min(entry.x.length, first + TRAIL);
		if (start > 0) {
			var space = entry.x.indexOf(" ", start);
			if (space !== -1 && space < first) start = space + 1;
		}
		if (end < entry.x.length) {
			var back = entry.x.lastIndexOf(" ", end);
			if (back > first) end = back;
		}

		var fragment = document.createDocumentFragment();
		if (start > 0) fragment.appendChild(document.createTextNode("…"));
		fragment.appendChild(highlight(entry.x.slice(start, end), folded.slice(start, end), terms));
		if (end < entry.x.length) fragment.appendChild(document.createTextNode("…"));
		return fragment;
	}

	function el(tag, className) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		return node;
	}

	function link(href, text) {
		var anchor = el("a");
		anchor.href = href;
		anchor.textContent = text;
		return anchor;
	}

	/**
	 * One result, in the markup partials/post-loop.njk emits for a post, so the
	 * theme's existing styles apply — minus the featured image, and with an
	 * excerpt where the post body would be.
	 */
	function result(entry, terms, publishedOn) {
		var wrapper = el("div", "post type-post status-publish format-standard hentry entry");
		var article = el("article");

		var header = el("div", "post-header");
		var title = el("h2", "post-title");
		title.appendChild(link(entry.u, entry.t));
		header.appendChild(title);

		var meta = el("span", "post-meta");
		meta.appendChild(document.createTextNode(publishedOn + " "));
		var date = el("span", "date");
		date.appendChild(link(entry.m, entry.p));
		meta.appendChild(date);
		header.appendChild(meta);

		var content = el("div", "post-content");
		var paragraph = document.createElement("p");
		paragraph.appendChild(excerpt(entry, terms));
		content.appendChild(paragraph);

		article.appendChild(header);
		article.appendChild(content);
		wrapper.appendChild(article);
		return wrapper;
	}

	/* ---------------------------------------------------------------------- */

	var container = document.getElementById("search-results");
	var query = new URLSearchParams(window.location.search).get(PARAM) || "";

	if (!container) {
		// Not the search page. The legacy WordPress addresses — /?s=term and
		// /pl/?s=term — still reach GitHub Pages, which ignores the query string
		// and serves the page as though nothing had been typed. Forward them to
		// the search page for the language this page is in, which is the language
		// the sidebar form already points at. `replace` keeps the back button
		// out of a loop between the two addresses.
		if (query) {
			var sidebarForm = document.querySelector(".widget_search .search-form");
			if (sidebarForm) {
				window.location.replace(
					sidebarForm.getAttribute("action") + "?" + PARAM + "=" + encodeURIComponent(query)
				);
			}
		}
		return;
	}

	var strings = {
		published: container.getAttribute("data-search-published"),
		heading: container.getAttribute("data-search-heading"),
		site: container.getAttribute("data-search-site"),
		prompt: container.getAttribute("data-search-prompt"),
		one: container.getAttribute("data-search-one"),
		many: container.getAttribute("data-search-many"),
	};
	var termNode = document.querySelector("[data-search-term]");
	var countNode = document.querySelector("[data-search-count]");
	var emptyNode = document.querySelector("[data-search-empty]");

	// "Search – Vangmar.pl", as base.njk rendered it. Kept so that clearing the
	// box restores it rather than leaving the tab labelled as the home page.
	var idleTitle = document.title;

	var index = null;
	function load() {
		if (!index) {
			index = fetch(container.getAttribute("data-search-index"))
				.then(function (response) {
					if (!response.ok) throw new Error("search index: " + response.status);
					return response.json();
				})
				.then(function (entries) {
					entries.forEach(function (entry) {
						entry.folded = {};
						FIELDS.forEach(function (field) {
							entry.folded[field.key] = fold(entry[field.key]);
						});
					});
					return entries;
				});
		}
		return index;
	}

	var current = "";

	function show(hits, terms) {
		container.textContent = "";
		hits.forEach(function (hit) {
			container.appendChild(result(hit.entry, terms, strings.published));
		});
		countNode.textContent = hits.length === 1
			? strings.one
			: strings.many.replace("%", hits.length);
		emptyNode.hidden = hits.length > 0;
	}

	function run(raw) {
		var trimmed = raw.trim();

		termNode.textContent = trimmed;
		document.title = trimmed
			? strings.heading + " " + trimmed + " – " + strings.site
			: idleTitle;

		if (!trimmed) {
			container.textContent = "";
			countNode.textContent = strings.prompt;
			emptyNode.hidden = true;
			return;
		}

		var terms = parse(trimmed);
		load().then(function (entries) {
			// A later keystroke may have overtaken this one while the index was
			// loading; only the term still in the box should be rendered.
			if (current === trimmed) show(search(entries, terms), terms);
		}).catch(function (error) {
			countNode.textContent = String((error && error.message) || error);
		});
	}

	function update(raw, remember) {
		current = raw.trim();
		if (remember) {
			var url = window.location.pathname
				+ (current ? "?" + PARAM + "=" + encodeURIComponent(current) : "");
			window.history.replaceState(null, "", url);
		}
		run(raw);
	}

	var timer = null;
	Array.prototype.forEach.call(document.querySelectorAll(".search-form"), function (form) {
		var input = form.querySelector(".search-field");
		if (!input) return;
		input.value = query;

		// The form works without this — it is a GET to this very page, and the
		// term would be read back out of the URL on reload. Handling it here
		// only saves the round trip.
		form.addEventListener("submit", function (event) {
			event.preventDefault();
			update(input.value, true);
		});

		input.addEventListener("input", function () {
			window.clearTimeout(timer);
			timer = window.setTimeout(function () { update(input.value, true); }, DEBOUNCE_MS);
		});
	});

	update(query, false);
})();
