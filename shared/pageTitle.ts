/** The browser tab title for a page — every route names itself so open tabs are distinguishable. */
export function pageTitle(section?: string | null): string {
  return section ? `${section} — The Daily` : "The Daily";
}
