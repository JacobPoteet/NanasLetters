// One shell for every admin subpage instead of scattered, unlinked routes —
// see CLAUDE.md's UI/layout exemption for /admin (utilitarian beats calm).

import type { ReactNode } from "react";
import { Link } from "../router";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <nav style={{ display: "flex", gap: 20, padding: "12px 24px", borderBottom: "1px solid #ccc", fontSize: 14 }}>
        <Link to="/admin">Review queue</Link>
        <Link to="/admin/browse">Browse &amp; edit letters</Link>
      </nav>
      {children}
    </div>
  );
}
