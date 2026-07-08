// 「連動ストリーク」: 学習ログと GitHub コミットの両方が積み上がった日を
// 可視化する純関数。GitHub 本家プロフィールには無い指標で、
// PRODUCT.md の独自性1(積み上げの可視化 × GitHub 連携)を体現する。
//
// 外部依存ゼロ・日付計算は呼び出し側(App.tsx)に任せ、ここでは
// ISO "YYYY-MM-DD" の配列 + Set の集合演算だけを行う。

export type SyncedStreakResult = {
  /** windowDatesAscending の末尾(今日)から遡って、github/study 両方が
   *  アクティブな日が連続する日数。末尾の日が非アクティブなら 0。 */
  currentStreak: number;
  /** window 内で最長の連続区間。 */
  longestStreak: number;
  /** window 内で両方アクティブな日の総数。 */
  totalSyncedDays: number;
};

export function computeSyncedStreak(
  windowDatesAscending: string[],
  githubActiveDates: Set<string>,
  studyActiveDates: Set<string>,
): SyncedStreakResult {
  if (windowDatesAscending.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalSyncedDays: 0 };
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let totalSyncedDays = 0;

  for (const date of windowDatesAscending) {
    const isSynced = githubActiveDates.has(date) && studyActiveDates.has(date);
    if (isSynced) {
      totalSyncedDays += 1;
      runningStreak += 1;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  // currentStreak は「末尾から連続する区間」。ループ終了時点の runningStreak が
  // そのまま末尾から続く連続日数になる(末尾が非アクティブなら 0 のまま)。
  const currentStreak = runningStreak;

  return { currentStreak, longestStreak, totalSyncedDays };
}
