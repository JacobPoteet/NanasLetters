import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { adjacentTick, listFractionAtScroll, pointerFraction, tickAtFraction } from "../../shared/timeScrubber";
import type { ScrubberTick } from "../../shared/timeScrubber";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Keeps a jumped-to month clear of the sticky year header.
const SCROLL_OFFSET = 80;

function label(tick: ScrubberTick | null): string {
  return tick ? `${MONTH_NAMES[tick.month - 1]} ${tick.year}` : "";
}

/** Page-space top of an element, independent of the current scroll. */
function pageTop(el: Element): number {
  return el.getBoundingClientRect().top + window.scrollY;
}

/**
 * A slim rail down the page edge standing in for the whole list: its height is
 * the list's height, so dragging or clicking it jumps anywhere in eight years
 * of letters, and the marker shows where the reader is. Month starts are
 * measured from the rendered list (`[data-month-key]`), not computed from
 * letter counts, so cards of any height stay honest.
 */
export function TimeScrubber({ listRef, contentKey }: { listRef: RefObject<HTMLElement | null>; contentKey: unknown }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [ticks, setTicks] = useState<ScrubberTick[]>([]);
  const [position, setPosition] = useState(0);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const dragging = useRef(false);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const listTop = pageTop(list);
    const listHeight = list.getBoundingClientRect().height;
    if (listHeight <= 0) return;
    const next: ScrubberTick[] = [];
    for (const el of list.querySelectorAll<HTMLElement>("[data-month-key]")) {
      const key = el.dataset.monthKey!;
      next.push({
        key,
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)),
        fraction: (pageTop(el) - listTop) / listHeight,
      });
    }
    setTicks(next);
  }, [listRef]);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, listRef, contentKey]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const list = listRef.current;
      if (!list) return;
      setPosition(
        listFractionAtScroll(window.scrollY, window.innerHeight, pageTop(list), list.getBoundingClientRect().height),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [listRef, contentKey]);

  function scrollToFraction(fraction: number) {
    const list = listRef.current;
    if (!list) return;
    window.scrollTo({ top: pageTop(list) + fraction * list.getBoundingClientRect().height - SCROLL_OFFSET });
  }

  function scrollToMonth(tick: ScrubberTick) {
    const el = listRef.current?.querySelector(`[data-month-key="${tick.key}"]`);
    if (el) window.scrollTo({ top: pageTop(el) - SCROLL_OFFSET });
  }

  function fractionOf(e: PointerEvent) {
    const rect = railRef.current!.getBoundingClientRect();
    return pointerFraction(e.clientY, rect.top, rect.height);
  }

  function onPointerDown(e: PointerEvent) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = fractionOf(e);
    setDragFraction(f);
    scrollToFraction(f);
  }

  function onPointerMove(e: PointerEvent) {
    const f = fractionOf(e);
    setHoverFraction(f);
    if (!dragging.current) return;
    setDragFraction(f);
    scrollToFraction(f);
  }

  function endDrag() {
    dragging.current = false;
    setDragFraction(null);
  }

  const current = tickAtFraction(ticks, position);

  function onKeyDown(e: KeyboardEvent) {
    let target: ScrubberTick | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") target = adjacentTick(ticks, current?.key ?? null, 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") target = adjacentTick(ticks, current?.key ?? null, -1);
    else if (e.key === "Home") target = ticks[0] ?? null;
    else if (e.key === "End") target = ticks[ticks.length - 1] ?? null;
    if (!target) return;
    e.preventDefault();
    scrollToMonth(target);
  }

  if (ticks.length === 0) return null;

  const tipFraction = dragFraction ?? hoverFraction;
  const tipTick = tipFraction === null ? null : tickAtFraction(ticks, tipFraction);
  const yearStarts = new Set<string>();
  const seenYears = new Set<number>();
  for (const t of ticks) {
    if (!seenYears.has(t.year)) {
      seenYears.add(t.year);
      yearStarts.add(t.key);
    }
  }

  return (
    <div
      ref={railRef}
      className="scrubber"
      role="slider"
      tabIndex={0}
      aria-label="Time in the archive"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position * 100)}
      aria-valuetext={label(current)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHoverFraction(null)}
      onKeyDown={onKeyDown}
    >
      {ticks.map((t) => (
        <span
          key={t.key}
          className={`scrubber__tick${yearStarts.has(t.key) ? " scrubber__tick--year" : ""}`}
          style={{ top: `${t.fraction * 100}%` }}
        >
          {yearStarts.has(t.key) && <span className="scrubber__year">{t.year}</span>}
        </span>
      ))}
      <span className="scrubber__marker" style={{ top: `${position * 100}%` }} />
      {tipTick && tipFraction !== null && (
        <span className="scrubber__tip" style={{ top: `${tipFraction * 100}%` }}>
          {label(tipTick)}
        </span>
      )}
    </div>
  );
}
