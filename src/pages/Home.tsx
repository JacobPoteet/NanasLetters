import { useEffect, useRef, useState } from "react";
import type { ArchiveStats, LetterSummary, OnThisDayResult } from "../../shared/types";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthDay(monthDay: string): string {
  const [month, day] = monthDay.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function formatMonthYear(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
}

function LetterCard({ letter }: { letter: LetterSummary }) {
  return (
    <div className="letter-card reveal-on-scroll">
      <div className="letter-card__year">{letter.date.slice(0, 4)}</div>
      <div className="letter-card__body">
        <div className="letter-card__excerpt">"{letter.excerpt}"</div>
        <Link to={`/letters/${letter.id}`} className="letter-card__link">
          Read the letter →
        </Link>
      </div>
      {letter.hasPhoto && <div className="photo-placeholder">photo</div>}
    </div>
  );
}

/** Counts a stat up from 0 once, on first render. A no-op under reduced motion — the final value renders immediately. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? target : 0,
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

function WelcomeStats({ stats }: { stats: ArchiveStats }) {
  const totalLetters = useCountUp(stats.totalLetters);

  return (
    <div className="home-masthead__stats">
      <div className="home-stat">
        <div className="home-stat__value">{totalLetters.toLocaleString()}</div>
        <div className="home-stat__label">letters kept</div>
      </div>
      <div className="home-stat">
        <div className="home-stat__value">{formatMonthYear(stats.firstDate)}</div>
        <div className="home-stat__label">the first one</div>
      </div>
      <div className="home-stat">
        <div className="home-stat__value">{formatMonthYear(stats.lastDate)}</div>
        <div className="home-stat__label">most recent</div>
      </div>
    </div>
  );
}

export function HomePage() {
  const [result, setResult] = useState<OnThisDayResult | null>(null);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onThisDay().then(setResult).catch((err) => setError(err.message));
    api.stats().then(setStats).catch(() => {});
    trackVisit("home");
  }, []);

  if (error) return <div className="content error-text">{error}</div>;
  if (!result) return <div className="content">Loading…</div>;

  const showingNearby = result.exact.length === 0;

  return (
    <div className="content">
      {stats && (
        <div className="home-masthead">
          <p className="home-masthead__intro">
            Since February 2018, Nana has written every morning — her garden, her coffee, her grandkids, whatever's
            on her mind that day — just above the meditation she forwards along. This is where those mornings are
            kept.
          </p>
          <WelcomeStats stats={stats} />
          <div className="home-masthead__links">
            <Link to="/browse">Browse every letter →</Link>
            <Link to="/search">Search the archive →</Link>
          </div>
        </div>
      )}

      <div className={stats ? "home-onthisday" : undefined}>
        <div className="eyebrow">On this day</div>
        <div className="big-date">{formatMonthDay(result.monthDay)}</div>
        <div className="subtext">Letters written on this day, across the years.</div>

        {showingNearby ? (
          <>
            <div className="empty-state">Nothing from exactly this day yet — here are a few days either side.</div>
            <div className="letter-list">
              {result.nearby.map((letter) => (
                <LetterCard key={letter.id} letter={letter} />
              ))}
            </div>
          </>
        ) : (
          <div className="letter-list">
            {result.exact.map((letter) => (
              <LetterCard key={letter.id} letter={letter} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
