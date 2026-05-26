import { useEffect, useState } from "react";

/**
 * Time-of-day buckets that drive the ambient "学びの大地" background.
 * Boundaries are inclusive on the low end and exclusive on the high end,
 * so the day rolls morning → day → evening → night without overlap.
 */
export type TimeOfDay = "morning" | "day" | "evening" | "night";

function resolveTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

/**
 * Returns the current time-of-day bucket and keeps it fresh by re-checking
 * once per minute. We don't need second-level precision — the background
 * gradient cross-fades over a couple of seconds anyway, and re-rendering
 * the whole shell every second would be wasteful.
 *
 * Re-evaluation also runs when the tab regains focus so users who left the
 * app open overnight see the right palette as soon as they come back.
 */
export function useTimeOfDay(): TimeOfDay {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => resolveTimeOfDay(new Date()));

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const next = resolveTimeOfDay(new Date());
      setTimeOfDay((prev) => (prev === next ? prev : next));
    };

    // Check every minute — cheap, and a minute of lag at a boundary is fine.
    const interval = window.setInterval(tick, 60_000);

    // Snap to the right bucket immediately on tab focus.
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return timeOfDay;
}
