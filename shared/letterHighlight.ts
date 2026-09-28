// Pure fold splitting a letter's text into the same "one paragraph per
// non-blank line" shape the letter view already renders, additionally
// locating a search match (a real substring of `text` — see
// worker/search.ts's plainSnippetText) so it can be highlighted where the
// family member left off reading — see issue #20.
//
// Only the first paragraph containing the whole match gets flagged: a
// letter can repeat a word, but there's exactly one spot the person searched
// their way to. A match that happens to straddle a paragraph break (rare —
// snippet()'s window is ~12 words) isn't found here and is simply not
// highlighted, rather than highlighting a broken partial match.
export interface LetterParagraph {
  text: string;
  highlightStart: number | null;
  highlightEnd: number | null;
}

export function paragraphsWithHighlight(text: string, matchText: string | null | undefined): LetterParagraph[] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  if (!matchText) {
    return lines.map((line) => ({ text: line, highlightStart: null, highlightEnd: null }));
  }

  let found = false;
  return lines.map((line) => {
    if (!found) {
      const start = line.indexOf(matchText);
      if (start !== -1) {
        found = true;
        return { text: line, highlightStart: start, highlightEnd: start + matchText.length };
      }
    }
    return { text: line, highlightStart: null, highlightEnd: null };
  });
}
