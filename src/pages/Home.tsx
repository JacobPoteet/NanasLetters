import { useEffect, useState } from "react";
import type { LetterSummary, OnThisDayResult } from "../../shared/types";
import { api } from "../api";
import { Link } from "../router";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonthDay(monthDay: string): string {
  const [month, day] = monthDay.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function LetterCard({ letter }: { letter: LetterSummary }) {
  return (
    <div className="letter-card">
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

export function HomePage() {
  const [result, setResult] = useState<OnThisDayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onThisDay().then(setResult).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="content error-text">{error}</div>;
  if (!result) return <div className="content">Loading…</div>;

  const showingNearby = result.exact.length === 0;

  return (
    <div className="content">
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
  );
}
