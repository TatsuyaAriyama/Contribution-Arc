/**
 * 忘却曲線(spaced repetition)に基づいて「そろそろ復習どきの学習対象」を
 * 判定する純関数群。
 *
 * 設計方針:
 *   - 追加の永続フィールドを持たない。学習記録 (StudyLog) の履歴だけから
 *     算出するので、Firestore のマイグレーションは不要。
 *   - ある学習対象を「別々の日に学習した回数」を反復回数 (repetitions) と
 *     みなし、回数が増えるほど次の復習間隔を伸ばす (1→3→7→14→30→60 日)。
 *   - 最後に学習した日 + 間隔 <= 今日 なら「復習どき」。超過日数が大きい
 *     ものほど優先度を高くして並べる。
 *   - すべてローカル日付 (0:00 境界) で扱う。dailyReminder.ts と同じく
 *     端末のローカル時刻前提で統一する。
 *
 * PRODUCT.md の「通知より習慣 / 引き戻さない」方針に沿い、この関数は
 * あくまで「静かに提示する候補」を返すだけで、通知の発火自体は行わない。
 */

/** 反復回数ごとの復習間隔 (日)。回数がこれを超えたら末尾の間隔を使う。 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;

/** 復習判定に必要な学習記録の最小形。 */
export type ReviewLogInput = {
  learningItemId?: string;
  createdAt: string;
};

/** 復習判定に必要な学習対象の最小形。 */
export type ReviewItemInput = {
  id: string;
  archived?: boolean;
  status?: string;
};

export type DueReview<T extends ReviewItemInput> = {
  item: T;
  /** その対象を最後に学習した時刻 (ISO)。 */
  lastStudiedAt: string;
  /** 別々の日に学習した回数 (>=1)。反復回数。 */
  repetitions: number;
  /** 今回適用した復習間隔 (日)。 */
  intervalDays: number;
  /** 復習予定日 (ローカル 0:00, ISO)。 */
  dueAt: string;
  /** 予定日を何日超過しているか (0 = ちょうど今日が予定日)。 */
  overdueDays: number;
};

/** ローカルタイムゾーンでその日の 0:00 の Date を返す。 */
function startOfLocalDay(value: Date): Date {
  const d = new Date(value.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** ローカル日付キー (YYYY-MM-DD)。反復回数の重複除去に使う。 */
function localDayKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 学習対象ごとに、復習が必要かどうかを判定して返す純関数。
 *
 * 返すのは「復習どき (overdueDays >= 0)」の対象のみ。超過日数が大きい順、
 * 同点なら最後に学習した時刻が古い順に並べる。
 */
export function getDueReviews<T extends ReviewItemInput>(
  items: readonly T[],
  logs: readonly ReviewLogInput[],
  now: Date,
): DueReview<T>[] {
  // 対象 id -> その対象に紐づくログの createdAt(ミリ秒) 一覧
  const timesByItem = new Map<string, number[]>();
  for (const log of logs) {
    const id = log.learningItemId;
    if (!id) continue;
    const time = new Date(log.createdAt).getTime();
    if (!Number.isFinite(time)) continue;
    const list = timesByItem.get(id);
    if (list) {
      list.push(time);
    } else {
      timesByItem.set(id, [time]);
    }
  }

  const todayStart = startOfLocalDay(now).getTime();
  const due: DueReview<T>[] = [];

  for (const item of items) {
    // アーカイブ済み / 完了 / 一時停止中の対象は復習を促さない。
    if (item.archived) continue;
    if (item.status === "done" || item.status === "paused") continue;

    const times = timesByItem.get(item.id);
    if (!times || times.length === 0) continue;

    // 別々の「日」の数 = 反復回数。同じ日に複数回記録しても 1 回と数える。
    const dayKeys = new Set<string>();
    let lastTime = -Infinity;
    for (const time of times) {
      dayKeys.add(localDayKey(new Date(time)));
      if (time > lastTime) lastTime = time;
    }
    const repetitions = dayKeys.size;
    if (repetitions === 0) continue;

    const intervalDays =
      REVIEW_INTERVALS_DAYS[Math.min(repetitions - 1, REVIEW_INTERVALS_DAYS.length - 1)];

    const dueStart = startOfLocalDay(new Date(lastTime)).getTime() + intervalDays * DAY_MS;
    const overdueDays = Math.floor((todayStart - dueStart) / DAY_MS);
    if (overdueDays < 0) continue;

    due.push({
      item,
      lastStudiedAt: new Date(lastTime).toISOString(),
      repetitions,
      intervalDays,
      dueAt: new Date(dueStart).toISOString(),
      overdueDays,
    });
  }

  due.sort((a, b) => {
    if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
    return new Date(a.lastStudiedAt).getTime() - new Date(b.lastStudiedAt).getTime();
  });

  return due;
}
