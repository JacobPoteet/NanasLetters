// Offline reader UI, bundled by scripts/archive.ts into reader/reader.js.
// Plain DOM, no framework: it has to keep working from a USB stick decades on.
import { onThisDay, searchLetters } from "../../shared/archiveSearch";
import { groupByYearMonth, longDate, MONTH_NAMES } from "../../shared/archiveMarkup";

const letters = window.ARCHIVE.letters; // oldest first
const indexByKey = new Map(letters.map((l, i) => [l.key, i]));
const app = document.getElementById("app");

function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function excerpt(text, max = 200) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

function card(letter, snippet) {
  return h(
    "a",
    { class: "card", href: `#/letter/${letter.key}` },
    h("span", { class: "year" }, letter.date.slice(0, 4)),
    h(
      "span",
      { class: "card-body" },
      h("span", { class: "card-date" }, longDate(letter.date).replace(/, \d{4}$/, "")),
      h("span", { class: "card-text" }, snippet ?? excerpt(letter.text)),
    ),
  );
}

function onThisDayView() {
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { exact, nearby } = onThisDay(letters, monthDay);
  const label = `${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
  const shown = exact.length > 0 ? exact : nearby;
  return h(
    "section",
    null,
    h("h1", null, "On this day"),
    h("p", { class: "lede" }, exact.length > 0 ? `Every ${label} Nana wrote.` : `Nothing on ${label} itself; here are letters from a few days either side.`),
    shown.length === 0 ? h("p", { class: "muted" }, "No letters near this date.") : shown.map((i) => card(letters[i])),
  );
}

function browseView(year) {
  const groups = groupByYearMonth(letters);
  if (!year) {
    return h(
      "section",
      null,
      h("h1", null, "Browse"),
      h(
        "div",
        { class: "years" },
        groups.map((g) =>
          h(
            "a",
            { class: "year-tile", href: `#/browse/${g.year}` },
            h("span", { class: "year" }, g.year),
            h("span", { class: "muted" }, `${g.months.reduce((n, m) => n + m.letters.length, 0)} letters`),
          ),
        ),
      ),
    );
  }
  const group = groups.find((g) => String(g.year) === year);
  if (!group) return h("p", null, "No letters that year.");
  return h(
    "section",
    null,
    h("p", null, h("a", { href: "#/browse" }, "All years")),
    h("h1", null, group.year),
    group.months.map((m) =>
      h(
        "div",
        { class: "month" },
        h("h2", null, MONTH_NAMES[m.month - 1]),
        m.letters.map((l) => card(l)),
      ),
    ),
  );
}

function searchView(params) {
  const q = params.get("q") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const form = h(
    "form",
    { class: "search", role: "search" },
    h("input", { type: "search", name: "q", value: q, placeholder: "Words Nana wrote", "aria-label": "Search words" }),
    h("label", null, "From ", h("input", { type: "date", name: "from", value: from })),
    h("label", null, "To ", h("input", { type: "date", name: "to", value: to })),
    h("button", { type: "submit" }, "Search"),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const next = new URLSearchParams();
    for (const k of ["q", "from", "to"]) if (data.get(k)) next.set(k, data.get(k));
    location.hash = `#/search?${next}`;
  });
  const out = h("section", null, h("h1", null, "Search"), form);
  if (!q.trim() && !from && !to) return out;
  const hits = searchLetters(letters, { query: q, from, to }).reverse();
  out.append(h("p", { class: "muted" }, `${hits.length} ${hits.length === 1 ? "letter" : "letters"}`));
  for (const hit of hits.slice(0, 200)) {
    const l = letters[hit.index];
    const snippet = hit.match
      ? h("span", { class: "card-text" }, hit.before, h("mark", null, hit.match), hit.after)
      : h("span", { class: "card-text" }, hit.after);
    out.append(
      h(
        "a",
        { class: "card", href: `#/letter/${l.key}` },
        h("span", { class: "year" }, l.date.slice(0, 4)),
        h("span", { class: "card-body" }, h("span", { class: "card-date" }, longDate(l.date).replace(/, \d{4}$/, "")), snippet),
      ),
    );
  }
  if (hits.length > 200) out.append(h("p", { class: "muted" }, "Showing the newest 200. Narrow the dates to see more."));
  return out;
}

function letterView(key) {
  const i = indexByKey.get(key);
  if (i === undefined) return h("p", null, "That letter is not in this archive.");
  const l = letters[i];
  const prev = letters[i - 1];
  const next = letters[i + 1];
  return h(
    "article",
    { class: "letter" },
    h("h1", null, longDate(l.date)),
    l.meditationTitle &&
      h(
        "p",
        { class: "meditation" },
        "Meditation that day: ",
        l.meditationUrl ? h("a", { href: l.meditationUrl }, l.meditationTitle) : l.meditationTitle,
      ),
    h("div", { class: "body" }, l.text.trim()),
    l.photos.map((p) => h("img", { src: p.file, alt: p.caption ?? "Photo from the letter" })),
    l.comments.length > 0 &&
      h(
        "section",
        { class: "comments" },
        h("h2", null, "Comments"),
        l.comments.map((c) =>
          h("div", { class: "comment" }, h("p", { class: "muted" }, `${c.authorName?.trim() || "A family member"}, ${c.createdAt.slice(0, 10)}`), h("p", null, c.body)),
        ),
      ),
    h(
      "nav",
      { class: "pager", "aria-label": "Neighboring letters" },
      prev ? h("a", { href: `#/letter/${prev.key}` }, `← ${prev.date}`) : h("span"),
      next ? h("a", { href: `#/letter/${next.key}` }, `${next.date} →`) : h("span"),
    ),
  );
}

function render() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/");
  let view;
  if (parts[0] === "browse") view = browseView(parts[1]);
  else if (parts[0] === "search") view = searchView(new URLSearchParams(query));
  else if (parts[0] === "letter" && parts[1]) view = letterView(decodeURIComponent(parts[1]));
  else view = onThisDayView();
  app.replaceChildren(view);
  window.scrollTo(0, 0);
  document.title = `${parts[0] === "letter" && parts[1] ? parts[1] : "The Daily"} - Nana's Letters archive`;
}

window.addEventListener("hashchange", render);
render();
