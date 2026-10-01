import { useEffect, useState } from "react";

// Appears only once the reader is well past the first screen, so it never
// competes with the page header when there is nowhere far to go back to.
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function update() {
      setVisible(window.scrollY > window.innerHeight * 1.5);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function toTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      className={`back-to-top${visible ? " back-to-top--visible" : ""}`}
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
