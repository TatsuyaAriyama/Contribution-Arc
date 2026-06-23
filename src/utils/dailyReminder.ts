/**
 * 日報リマインドの「いま出すべき時間帯」を判定する純関数。
 *
 * 仕様:
 *   - 朝と夜にそれぞれ 1 日 1 回まで促す。
 *   - すでに今日の日報を出していれば (reportSubmittedToday) 何も出さない。
 *   - その時間帯のリマインドを今日すでに出していれば出さない
 *     (morningSentDate / eveningSentDate に今日のキーが入っているか)。
 *   - 朝/夜の時間帯は [開始時, 終了時) の 24h ローカル時刻で判定する。
 */
export type DailyReminderSlot = "morning" | "evening";

export function getDueDailyReminder(opts: {
  /** 現在時刻 (ローカル)。 */
  now: Date;
  /** 今日のローカル日付キー (YYYY-MM-DD)。 */
  todayKey: string;
  /** 今日すでに日報を出したか。 */
  reportSubmittedToday: boolean;
  /** 朝のリマインドを最後に出した日付キー。 */
  morningSentDate: string;
  /** 夜のリマインドを最後に出した日付キー。 */
  eveningSentDate: string;
  /** 朝の時間帯 [開始時, 終了時)。既定 7:00–11:00。 */
  morningWindow?: readonly [number, number];
  /** 夜の時間帯 [開始時, 終了時)。既定 19:00–23:00。 */
  eveningWindow?: readonly [number, number];
}): DailyReminderSlot | null {
  if (opts.reportSubmittedToday) return null;
  const hour = opts.now.getHours();
  const [mStart, mEnd] = opts.morningWindow ?? [7, 11];
  const [eStart, eEnd] = opts.eveningWindow ?? [19, 23];
  if (hour >= mStart && hour < mEnd && opts.morningSentDate !== opts.todayKey) {
    return "morning";
  }
  if (hour >= eStart && hour < eEnd && opts.eveningSentDate !== opts.todayKey) {
    return "evening";
  }
  return null;
}
