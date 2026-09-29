import { pageTitle } from "../../shared/pageTitle";
import { Link } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle(pageTitle("Page not found"));

  return (
    <div className="content">
      <div className="eyebrow">Not found</div>
      <div className="big-date" style={{ fontSize: 40 }}>
        There's nothing here
      </div>
      <div className="subtext">That page doesn't exist, or the letter it pointed to may have been removed.</div>
      <div style={{ marginTop: 24 }}>
        <Link to="/">← Back to On this day</Link>
      </div>
    </div>
  );
}
