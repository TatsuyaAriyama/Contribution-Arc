/**
 * GitHub Contributions fetcher.
 *
 * GitHub doesn't expose the contribution-grid counts via the official REST
 * API. The community-maintained jogruber endpoint scrapes the same data
 * GitHub renders on the public profile page and returns it as JSON. We use
 * it so we don't have to hold an OAuth token just to read public counts.
 *
 * Endpoint: https://github-contributions-api.jogruber.de/v4/{username}?y=last
 * Response shape (relevant fields):
 *   {
 *     total: { lastYear: number, ... },
 *     contributions: Array<{ date: "YYYY-MM-DD", count: number, level: 0|1|2|3|4 }>
 *   }
 *
 * Caveats:
 * - Private contributions are not included (consistent with the public grid).
 * - Third-party host: if it goes down, we just show "GitHub データを取得できませんでした".
 * - We cache per username for 1 hour to keep the API friendly and the UI snappy.
 */

export type GithubContributionDay = {
  date: string; // ISO "YYYY-MM-DD"
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type GithubContributions = {
  total: number;
  days: GithubContributionDay[];
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const LS_PREFIX = "ca:gh-contrib:";

type CacheEntry = { fetchedAt: number; data: GithubContributions };
const memoryCache = new Map<string, CacheEntry>();

function readLocalCache(username: string): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + username);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.fetchedAt !== "number" || !Array.isArray(parsed?.data?.days)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(username: string, entry: CacheEntry): void {
  try {
    window.localStorage.setItem(LS_PREFIX + username, JSON.stringify(entry));
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Fetch a user's last-year contribution grid. Resolves with cached data if
 * fresh; otherwise hits the jogruber endpoint and caches the result.
 *
 * Rejects on network / 4xx / 5xx so the caller can show an error state.
 */
export async function fetchGithubContributions(username: string): Promise<GithubContributions> {
  const key = username.trim().toLowerCase();
  if (!key) throw new Error("username is required");

  const cached = memoryCache.get(key) ?? null;
  if (isFresh(cached)) return cached.data;

  const stored = readLocalCache(key);
  if (isFresh(stored)) {
    memoryCache.set(key, stored);
    return stored.data;
  }

  const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(key)}?y=last`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GitHub contributions fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    total?: Record<string, number>;
    contributions?: Array<{ date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }>;
  };

  const days: GithubContributionDay[] = (json.contributions || []).map((d) => ({
    date: d.date,
    count: d.count,
    level: d.level,
  }));
  // The endpoint returns totals keyed by year (e.g. "lastYear", "2025"). We
  // recompute from days so we don't depend on a specific key surviving.
  const total = days.reduce((sum, d) => sum + d.count, 0);

  const entry: CacheEntry = { fetchedAt: Date.now(), data: { total, days } };
  memoryCache.set(key, entry);
  writeLocalCache(key, entry);
  return entry.data;
}
