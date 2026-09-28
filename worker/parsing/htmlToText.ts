// A small, hand-written HTML→text pass — not Cloudflare's HTMLRewriter.
//
// HTMLRewriter only runs inside workerd, and Lunch Special's convention (which
// this project mirrors — see CLAUDE.md's Tooling note) is that every pure fold
// runs under plain vitest in Node, no @cloudflare/vitest-pool-workers. Rather
// than add that just for this one function, stripping <style>/<script> and
// converting the rest to text is simple enough to hand-write as an ordinary
// pure fold — which is also what caught the CSS-junk bug during the parsing
// experiment (a recent letter's <style> block leaking into the "plain text"
// as visible text) in the first place.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function stripStyleAndScript(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name] ?? match);
}

/**
 * Converts an HTML email body to readable plain text: drops style/script
 * content entirely, turns block-level boundaries into newlines before
 * stripping the remaining tags, decodes entities, and collapses the
 * whitespace that leaves behind.
 */
export function htmlToText(html: string): string {
  let text = stripStyleAndScript(html);
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|tr|table|h[1-6]|li|blockquote)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
