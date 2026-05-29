/**
 * 平日連続記録(ストリーク)の計算。
 *
 * プロダクト方針はもともと「煽り系NG(ストリーク/ランキング/達成通知)」
 * だったが、方針転換して "静かに積み上がる" ストリークだけ採り入れる
 * ことにした。Duolingo 的な罪悪感ドリブン(失効演出・赤字・プッシュ
 * 通知)はやらない。トップバーに控えめな数字を出すだけ。
 *
 * 仕様(ユーザー合意済み):
 *   - カウント条件: その日に「学習記録 / 日報 / GitHub contribution」の
 *     いずれかがあれば成立(OR・ゆるめ)。
 *   - 土日は対象外: 週末はカウントもしないし、ストリークも切らない
 *     (平日だけを連結して数える)。
 *   - 猶予なし: 平日に記録が無ければその時点でストリークは途切れる。
 *     ただし「今日」だけは進行中とみなし、まだ未記録でも切らない。
 *   - 途切れたら静かに 0 に戻るだけ。失効演出は出さない。
 *
 * 日付キーは getLearnerDate 由来の "YYYY-MM-DD"(ローカル, 6AM 始まり)
 * を前提とする。
 */

export type StreakInfo = {
  /** 今日まで連続している平日の数。土日はスキップして数える。 */
  current: number;
  /** 今日が平日で、すでに記録済みか(トップバーの塗り分けに使う)。 */
  todayCounts: boolean;
  /** 今日が土日か(土日は「対象外」表示にできる)。 */
  todayIsWeekend: boolean;
};

function dayOfWeek(key: string): number {
  // ローカル深夜としてパースして曜日を得る(0=日, 6=土)。
  const d = new Date(`${key}T00:00:00`);
  return d.getDay();
}

function isWeekend(key: string): boolean {
  const dow = dayOfWeek(key);
  return dow === 0 || dow === 6;
}

function prevDateKey(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * `activeDates` に含まれる日付("YYYY-MM-DD")をもとに、`todayKey` から
 * さかのぼって平日連続記録を数える。
 */
export function computeStudyStreak(activeDates: Set<string>, todayKey: string): StreakInfo {
  const todayIsWeekend = isWeekend(todayKey);
  const todayCounts = !todayIsWeekend && activeDates.has(todayKey);

  let count = 0;
  let cursor = todayKey;

  // 暴走防止に約2年で打ち切り。実用上ここに達することはまずない。
  for (let i = 0; i < 366 * 2; i++) {
    if (isWeekend(cursor)) {
      // 週末はカウントもしないしストリークも切らない。前日へ。
      cursor = prevDateKey(cursor);
      continue;
    }
    // 平日
    if (activeDates.has(cursor)) {
      count++;
    } else if (cursor === todayKey) {
      // 今日は進行中とみなす。未記録でも切らずに前日を見る。
      // (カウントには入れない)
    } else {
      // 過去の平日が未記録 = ここでストリークは途切れる。
      break;
    }
    cursor = prevDateKey(cursor);
  }

  return { current: count, todayCounts, todayIsWeekend };
}
