// Pure fold guarding every path the router is handed against escaping to a
// different origin or scheme. A `to` can come straight from a URL query
// param (see src/pages/Letter.tsx's `from=` link back to search results), so
// it has to be validated before it ever reaches an <a href> or
// history.pushState/replaceState — otherwise it's a client-side XSS /
// open-redirect sink (e.g. a "javascript:" URI, or a protocol-relative
// "//evil.example" that resolves to a different host).
export function resolveInternalPath(to: string, origin: string): string {
  try {
    const url = new URL(to, origin);
    return url.origin === origin ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}
