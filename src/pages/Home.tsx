import { useEffect, useState } from "react";
import type { ArchiveStats, LetterSummary, OnThisDayResult, RecentComment } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

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
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatFullDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

const COMMENT_FEED_BODY_LENGTH = 140;

function truncateComment(body: string): string {
  return body.length > COMMENT_FEED_BODY_LENGTH ? `${body.slice(0, COMMENT_FEED_BODY_LENGTH).trimEnd()}…` : body;
}

function RecentCommentRow({ comment }: { comment: RecentComment }) {
  return (
    <div className="recent-comment reveal-on-scroll">
      <div className="recent-comment__meta">
        <span className="recent-comment__author">{comment.authorName ?? "A family member"}</span>
        <span className="recent-comment__on"> on </span>
        <Link to={`/letters/${comment.letterId}?comment=${comment.id}`}>the letter from {formatFullDate(comment.letterDate)}</Link>
      </div>
      <p className="recent-comment__body">"{truncateComment(comment.body)}"</p>
    </div>
  );
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

export function HomePage() {
  const [result, setResult] = useState<OnThisDayResult | null>(null);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(pageTitle());

  useEffect(() => {
    api.onThisDay().then(setResult).catch((err) => setError(err.message));
    api.stats().then(setStats).catch(() => {});
    api
      .recentComments()
      .then((r) => setRecentComments(r.comments))
      .catch(() => {});
    trackVisit("home");
  }, []);

  if (error) return <div className="content error-text">{error}</div>;
  if (!result) return <div className="content">Loading…</div>;

  const showingNearby = result.exact.length === 0;
  const letters = showingNearby ? result.nearby : result.exact;
  // Genuinely empty archive (an unseeded local dev DB, say) — a "0 letters
  // kept" line would read as broken, not informative, so skip it entirely.
  const showMasthead = stats !== null && stats.totalLetters > 0 && stats.firstLetterId !== null;

  return (
    <div className="content content--home">
      {showMasthead && (
        <p className="home-masthead">
          {stats.totalLetters.toLocaleString()} letters, kept since {formatMonthYear(stats.firstDate)} —{" "}
          <Link to={`/letters/${stats.firstLetterId}`}>including the very first one →</Link>
        </p>
      )}

      <div className="home-grid">
      <div className={showMasthead ? "home-onthisday" : undefined}>
        <div className="eyebrow">On this day</div>
        <div className="big-date">{formatMonthDay(result.monthDay)}</div>
        <div className="subtext">Letters written on this day, across the years.</div>

        {showingNearby && (
          <div className="empty-state">Nothing from exactly this day yet — here are a few days either side.</div>
        )}
        <div className="letter-list">
          {letters.map((letter) => (
            <LetterCard key={letter.id} letter={letter} />
          ))}
        </div>
      </div>

      {recentComments.length > 0 && (
        <div className="recent-comments">
          <div className="eyebrow">Recent comments</div>
          <div className="subtext">What the family's been saying, across the archive.</div>
          <div className="recent-comment-list">
            {recentComments.map((comment) => (
              <RecentCommentRow key={comment.id} comment={comment} />
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
