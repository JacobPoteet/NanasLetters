import { useEffect, useState } from "react";
import type { ArchiveStats, LetterSummary, OnThisDayResult, RecentComment } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { trackVisit } from "../analytics";
import { Link, useRouter } from "../router";
import { openRandomLetter } from "../surprise";
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

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
  const { navigate } = useRouter();
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
  if (!result) return <div className="content loading-state">Gathering the morning's letters…</div>;

  const showingNearby = result.exact.length === 0;
  const letters = showingNearby ? result.nearby : result.exact;
  const [featured, ...others] = letters;
  const showFootnote = stats !== null && stats.totalLetters > 0 && stats.firstLetterId !== null;

  return (
    <div className="content content--home">
      <header className="home-hero">
        <h1 className="home-hero__greeting">{greeting()}</h1>
        <p className="home-hero__lede">
          {showingNearby
            ? `Nana didn't write on ${formatMonthDay(result.monthDay)}, so here are the days around it.`
            : `Here is what Nana wrote on ${formatMonthDay(result.monthDay)}, across the years.`}
        </p>
      </header>

      <div className="home-grid">
      <div>
        {featured && (
          <figure className="home-feature">
            <blockquote className="home-feature__quote">{featured.excerpt}</blockquote>
            <figcaption className="home-feature__cite">
              <span className="home-feature__year">{formatFullDate(featured.date)}</span>
              <Link to={`/letters/${featured.id}`} className="letter-card__link">
                Read the whole letter →
              </Link>
            </figcaption>
          </figure>
        )}

        {others.length > 0 && (
          <div className="letter-list letter-list--more">
            {others.map((letter) => (
              <LetterCard key={letter.id} letter={letter} />
            ))}
          </div>
        )}

        {!featured && (
          <div className="empty-state empty-state--nearby">
            <button type="button" className="surprise-more__button" onClick={() => openRandomLetter(navigate)}>
              Let a letter find you.
            </button>
          </div>
        )}

        {showFootnote && (
          <p className="home-footnote">
            {stats.totalLetters.toLocaleString()} letters, kept since {formatMonthYear(stats.firstDate)}.{" "}
            <Link to={`/letters/${stats.firstLetterId}`}>Read the very first one →</Link>{" "}
            <button type="button" className="home-footnote__surprise" onClick={() => openRandomLetter(navigate)}>
              Or let one find you.
            </button>
          </p>
        )}
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
