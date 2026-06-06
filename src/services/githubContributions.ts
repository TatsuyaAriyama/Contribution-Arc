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
 *
 * Cost / rate-limit discipline (this file is the single choke point):
 * - Success cache: 6h per username (memory + localStorage). Contribution
 *   grids change at most once a day, so an hourly refresh was wasteful.
 * - In-flight dedup: concurrent callers for the same username share one
 *   network request (friends list + own card often fire together).
 * - Negative cache: a 404 (no such user) is remembered for 6h so a bad
 *   fallback username doesn't get re-requested on every mount.
 * - Global cooldown: once the endpoint answers 429/403 (rate limited) we
 *   stop hitting the network entirely for RATE_LIMIT_COOLDOWN_MS and fail
 *   fast from cache. This is what actually stops the "レート制限" spiral —
 *   without it, every friend card + the 4-candidate retry loop kept
 *   hammering the limited endpoint.
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

/** レート制限に当たったと判別できるエラー。呼び出し側 (App.tsx) は
 *  これを見て「残りの候補を試さず即中断」する。 */
export class GithubRateLimitError extends Error {
  constructor(message = "GitHub API のレート制限に達しました。しばらくしてから再度お試しください。") {
    super(message);
    this.name = "GithubRateLimitError";
  }
}

const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (no-such-user)
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min global backoff
const LS_PREFIX = "ca:gh-contrib:";
const LS_NEG_PREFIX = "ca:gh-contrib-miss:";

type CacheEntry = { fetchedAt: number; data: GithubContributions };
const memoryCache = new Map<string, CacheEntry>();
/** username -> 最後に 404 と判明した時刻 (ms) */
const negativeCache = new Map<string, number>();
/** username -> 進行中の fetch Promise (重複リクエスト抑止) */
const inflight = new Map<string, Promise<GithubContributions>>();
/** 0 より大きければ「この時刻まではネットワークに触らない」 */
let rateLimitedUntil = 0;

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

function readNegativeCache(username: string): number | null {
  const mem = negativeCache.get(username);
  if (typeof mem === "number") return mem;
  try {
    const raw = window.localStorage.getItem(LS_NEG_PREFIX + username);
    if (!raw) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

function writeNegativeCache(username: string): void {
  const now = Date.now();
  negativeCache.set(username, now);
  try {
    window.localStorage.setItem(LS_NEG_PREFIX + username, String(now));
  } catch {
    /* ignore */
  }
}

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return !!entry && Date.now() - entry.fetchedAt < SUCCESS_TTL_MS;
}

/**
 * Fetch a user's last-year contribution grid. Resolves with cached data if
 * fresh; otherwise hits the jogruber endpoint and caches the result.
 *
 * Rejects with:
 *   - GithubRateLimitError when the endpoint is (or recently was) rate limited
 *   - Error("...404") when the username doesn't exist
 *   - Error on other network / 5xx failures
 */
export async function fetchGithubContributions(username: string): Promise<GithubContributions> {
  const key = username.trim().toLowerCase();
  if (!key) throw new Error("username is required");

  // 1) フレッシュな成功キャッシュ (memory → localStorage)
  const cached = memoryCache.get(key) ?? null;
  if (isFresh(cached)) return cached.data;

  // stored は「期限切れも含む」localStorage キャッシュ。fresh なら即返す。
  // 期限切れでも、レート制限クールダウン中の stale フォールバックに使う。
  const stored = readLocalCache(key);
  if (isFresh(stored)) {
    memoryCache.set(key, stored);
    return stored.data;
  }

  // 2) グローバルなレート制限クールダウン中はネットワークに触れない。
  //    期限切れの成功キャッシュ (stored) があればそれを返して UX を保つ。
  //    ※ isFresh の型ガードで stored は上で null 扱いに狭まるため、
  //      ここでは改めて読み直す (期限切れでもキャッシュを使いたい)。
  if (Date.now() < rateLimitedUntil) {
    const staleStored = readLocalCache(key);
    if (staleStored) {
      memoryCache.set(key, staleStored);
      return staleStored.data;
    }
    throw new GithubRateLimitError();
  }

  // 3) ネガティブキャッシュ (存在しない username) — 無駄打ちを防ぐ
  const missAt = readNegativeCache(key);
  if (typeof missAt === "number" && Date.now() - missAt < NEGATIVE_TTL_MS) {
    throw new Error(`GitHub contributions fetch failed: 404 (cached miss)`);
  }

  // 4) 同一 username の同時リクエストは 1 本に集約
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(key)}?y=last`;
    const res = await fetch(url);

    if (res.status === 429 || res.status === 403) {
      // レート制限：以後 15 分はネットワークに触れない。
      rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw new GithubRateLimitError();
    }
    if (res.status === 404) {
      writeNegativeCache(key);
      throw new Error(`GitHub contributions fetch failed: 404`);
    }
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
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/** レート制限中かどうか (呼び出し側が UI を出し分けたい時用) */
export function isGithubRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}
