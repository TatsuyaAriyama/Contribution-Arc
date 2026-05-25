/**
 * Tiny 13-week GitHub heatmap for the sidebar friend cards.
 *
 * Reuses the shared fetcher in services/githubContributions.ts (which
 * caches per-username for 1h) so opening the sidebar for multiple
 * friends doesn't hit the third-party API repeatedly.
 *
 * Renders nothing while loading or on error — the friend card stays
 * visually intact and a stale/missing chart never blocks the rest of
 * the sidebar.
 */
import { useEffect, useState } from "react";
import { fetchGithubContributions } from "../services/githubContributions";

const WEEKS = 13;
type Level = 0 | 1 | 2 | 3 | 4;
type MiniCell = { level: Level } | null;

function buildMiniGrid(days: { date: string; level: Level }[]): MiniCell[][] {
  const byKey = new Map<string, Level>();
  for (const d of days) {
    const [y, m, dd] = d.date.split("-").map((n) => Number(n));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(dd)) continue;
    byKey.set(`${y}-${m - 1}-${dd}`, d.level);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOffset = (WEEKS - 1) * 7 + today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - startOffset);

  const weeks: MiniCell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const cells: MiniCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      if (date > today) {
        cells.push(null);
        continue;
      }
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      cells.push({ level: byKey.get(key) ?? 0 });
    }
    weeks.push(cells);
  }
  return weeks;
}

export function FriendGithubMini({ username }: { username: string }) {
  const [grid, setGrid] = useState<MiniCell[][] | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    fetchGithubContributions(username)
      .then((data) => {
        if (!cancelled) setGrid(buildMiniGrid(data.days));
      })
      .catch(() => {
        /* silently hide on error so a broken third-party API
           doesn't litter the sidebar with error states */
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!grid) return null;

  return (
    <div className="friend-github-mini" aria-hidden="true">
      {grid.map((week, wi) => (
        <div className="friend-github-mini-week" key={wi}>
          {week.map((cell, di) =>
            cell ? (
              <i key={di} className={`friend-github-mini-cell lv-${cell.level}`} />
            ) : (
              <i key={di} className="friend-github-mini-cell empty" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
