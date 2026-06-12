/**
 * Pure formatting & date helpers extracted from App.tsx (Phase 4 refactor).
 *
 * 何を入れるか:
 *   - 外部依存ゼロのピュア関数のみ
 *   - 日付計算 / 時間フォーマット / 数値クランプ
 *
 * 何を入れないか:
 *   - React コンポーネント / hook を使うもの
 *   - Firestore / window / localStorage に触るもの
 *   - 学習ドメイン固有のロジック (Plan items / Streak など、専用の service 配下)
 */

// ===== 数値 =====

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ===== 日付 / 週 =====

/** YYYY-MM-DD (local time). `<input type="date">` の value 用。 */
export function getDateInputValue(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Engineers often work past midnight; treat the "day" as rolling over at
 * 6:00 AM local time. So 2 AM on May 24 still counts as May 23's session —
 * and the new day's prompt only appears once the user wakes up.
 */
export const DAILY_CUTOFF_HOUR = 6;

export function getLearnerDate(now: Date = new Date()) {
  const shifted = new Date(now.getTime() - DAILY_CUTOFF_HOUR * 60 * 60 * 1000);
  return getDateInputValue(shifted);
}

/** Monday-start week. */
export function getWeekStart(date: Date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Sunday-start week key (YYYY-M-D of the week's Sunday).
 * 故意に getWeekStart (月曜始まり) と境界が違う — contribution-arc グリッドの
 * `thisWeekMinutes` (日曜始まり) と揃えるため。プロフィールの weekMinutes が
 * "現在" かの判定に使われる。
 */
export function getCurrentWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Date.toDateString() ベースの日キー (ロケール表現は使わない)。 */
export function getTodayKey(date: Date = new Date()) {
  return date.toDateString();
}

// ===== 表示用 =====

/** "X日 (短曜日)" の和文表記。invalid なら元文字列を返す。 */
export function formatDailyDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }
  return parsedDate.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** 60 分未満は "N分"、それ以上は小数 1 桁の "N.N時間"。 */
export function formatStudyTimeJa(minutes: number) {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}時間`;
}

/** 60 分未満は "N分"、それ以上は "H時間" or "H時間M分"。 */
export function formatStayTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}時間${rest}分` : `${hours}時間`;
}

/**
 * Compact "last logged" label used on learning cards.
 * 未記録 / 今日 / 昨日 / N日前 / N週間前 / Nヶ月前 / N年前 に分類。
 */
export function formatLearningLastLogged(
  lastTs: number | undefined,
  todayMidnightMs: number,
  dayMs: number,
) {
  if (!lastTs) return "未記録";
  if (lastTs >= todayMidnightMs) return "今日";
  const yesterdayMidnight = todayMidnightMs - dayMs;
  if (lastTs >= yesterdayMidnight) return "昨日";
  const diffDays = Math.max(1, Math.floor((todayMidnightMs - lastTs) / dayMs));
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}
