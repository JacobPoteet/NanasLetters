import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { adjacentTick, fisheye, inverseFisheye, listFractionAtScroll, tickAtFraction } from "../../shared/timeScrubber";
import type { ScrubberTick } from "../../shared/timeScrubber";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Keeps a jumped-to month clear of the sticky year header.
const SCROLL_OFFSET = 80;

// Magnification at the pointer is MAGNIFY + 1; the rail ends stay pinned.
const MAGNIFY = 1;
// Minimum drawn gap between two labels before the later one is dropped.
const LABEL_GAP = 15;
// How fast the lens opens and closes, per frame (eased toward its target).
const LENS_EASE = 0.09;

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
  const [focusY, setFocusY] = useState(0);
  const [railHeight, setRailHeight] = useState(0);
  const [lens, setLens] = useState(0);
  const lensTarget = useRef(0);
  const lensValue = useRef(0);
  const lensFrame = useRef(0);
  const dragging = useRef(false);

  // Eases the lens open and shut so the rail swells under the pointer rather than snapping.
  const animateLens = useCallback(() => {
    if (lensFrame.current) return;
    const step = () => {
      lensFrame.current = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const next = reduced ? lensTarget.current : lensValue.current + (lensTarget.current - lensValue.current) * LENS_EASE;
      lensValue.current = Math.abs(next - lensTarget.current) < 0.004 ? lensTarget.current : next;
      setLens(lensValue.current);
      if (lensValue.current !== lensTarget.current) lensFrame.current = requestAnimationFrame(step);
    };
    lensFrame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => cancelAnimationFrame(lensFrame.current), []);

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

  const hasTicks = ticks.length > 0;
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const read = () => setRailHeight(rail.getBoundingClientRect().height);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [hasTicks]);

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

  const focusRef = useRef(0);

  /** The list fraction under the pointer, accounting for the lens's current magnification. */
  function fractionOf(e: PointerEvent) {
    const rect = railRef.current!.getBoundingClientRect();
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top));
    return inverseFisheye(y, focusRef.current, rect.height, lensValue.current * MAGNIFY) / rect.height;
  }

  function track(e: PointerEvent) {
    const rect = railRef.current!.getBoundingClientRect();
    focusRef.current = Math.min(rect.height, Math.max(0, e.clientY - rect.top));
    setFocusY(focusRef.current);
    setRailHeight(rect.height);
    lensTarget.current = 1;
    animateLens();
  }

  function onPointerDown(e: PointerEvent) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrollToFraction(fractionOf(e));
  }

  function onPointerMove(e: PointerEvent) {
    // Resolve the target against the lens as the pointer sees it, then move the lens to the pointer.
    const f = fractionOf(e);
    track(e);
    if (dragging.current) scrollToFraction(f);
  }

  function endDrag() {
    dragging.current = false;
  }

  function onPointerLeave() {
    if (dragging.current) return;
    lensTarget.current = 0;
    animateLens();
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

  const H = railHeight;
  const d = lens * MAGNIFY;
  const drawn = (fraction: number) => fisheye(fraction * H, focusY, H, d);
  const yearStarts = new Set<string>();
  const seenYears = new Set<number>();
  for (const t of ticks) {
    if (!seenYears.has(t.year)) {
      seenYears.add(t.year);
      yearStarts.add(t.key);
    }
  }

  // Years always label; months label only where the lens has opened enough room around them.
  const placed: number[] = [];
  const ys = ticks.map((t) => drawn(t.fraction));
  ticks.forEach((t, i) => yearStarts.has(t.key) && placed.push(ys[i]));
  const labelled = new Set<string>();
  if (lens > 0.05) {
    ticks.forEach((t, i) => {
      if (yearStarts.has(t.key)) return;
      if (placed.every((p) => Math.abs(p - ys[i]) >= LABEL_GAP)) {
        placed.push(ys[i]);
        labelled.add(t.key);
      }
    });
  }
  const nearest = lens > 0.05 ? tickAtFraction(ticks, inverseFisheye(focusY, focusY, H, d) / (H || 1)) : null;
  // Only the hovered year shows its months, so older years stay quiet until pointed at.
  const activeYear = nearest?.year ?? null;
  const markerY = drawn(position);

  return (
    <div
      ref={railRef}
      className={`scrubber${lens > 0.05 ? " scrubber--lens" : ""}`}
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
      onPointerUp={(e) => {
        endDrag();
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onPointerLeave();
      }}
      onPointerCancel={() => {
        endDrag();
        onPointerLeave();
      }}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      {ticks.map((t, i) => {
        const isYear = yearStarts.has(t.key);
        // Ticks swell and brighten with their closeness to the pointer, like a dock icon.
        const closeness = lens * Math.exp(-(((ys[i] - focusY) / 46) ** 2));
        const isNearest = nearest?.key === t.key;
        const showLabel = isYear || labelled.has(t.key);
        return (
          <span
            key={t.key}
            className={`scrubber__tick${isYear ? " scrubber__tick--year" : ""}${isNearest ? " scrubber__tick--active" : ""}`}
            style={{ top: `${ys[i]}px`, width: `${(isYear ? 14 : 7) + closeness * 8}px`, opacity: 1 }}
          >
            {showLabel && (
              <span
                className={`scrubber__label${isYear ? " scrubber__label--year" : ""}`}
                style={{
                  opacity: isYear ? 1 : t.year === activeYear ? Math.min(1, lens * (0.5 + closeness)) : 0,
                  fontSize: `${11 + closeness * 1.5}px`,
                  right: `${22 + closeness * 6}px`,
                }}
              >
                {isNearest && !isYear ? `${MONTH_NAMES[t.month - 1]} ${t.year}` : isYear ? t.year : MONTH_NAMES[t.month - 1].slice(0, 3)}
              </span>
            )}
          </span>
        );
      })}
      <span className="scrubber__marker" style={{ top: `${markerY}px` }} />
    </div>
  );
}
