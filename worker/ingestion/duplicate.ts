// Same-day duplicate handling — see CLAUDE.md's parsing findings ("three
// near-identical copies of one letter sent minutes apart have been seen").
// An exact resend (once whitespace differences are normalized away) is
// auto-merged (silently skipped, since a letter for that date already
// exists); anything that actually differs is left for a human in the review
// queue rather than guessed at.

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function isSameLetter(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}
