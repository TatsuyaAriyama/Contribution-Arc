/**
 * 集中の気配 (focusPresence) — Phase 2「計測と共在の融合」。
 *
 * フォーカスセッション(計測)中のユーザーの気配を、部屋に入らなくても
 * ホームとロビーに灯すための最小プレゼンス。1 人 1 枚の
 * `focusPresence/{uid}` ドキュメントを best-effort で publish /
 * heartbeat / clear するだけで、書き込み失敗が計測本体(useFocusSession)
 * を巻き込まないよう、この層の関数は例外を投げずに console.error で
 * 握りつぶす。
 *
 * 取得はライブ購読(onSnapshot)を使わない。このプロジェクトは
 * onSnapshot の同時使用数を厳格に管理しており(claude-progress.txt の
 * F-LISTENER-BUDGET)、常在ユーザー全員の気配を購読すると予算を圧迫する
 * ため、フィード表示時・pull-to-refresh・ロビー更新など「見るタイミング」
 * に限定した一回限りの `getDocs` に留める。
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Firestore,
} from "firebase/firestore";

export type FocusPresenceMode = "stopwatch" | "pomodoro";

export type FocusPresenceRecord = {
  userId: string;
  name: string;
  characterColor?: string;
  characterShape?: string;
  /** 学習対象名 */
  subject: string;
  mode: FocusPresenceMode;
  /** epoch ms */
  startedAt: number;
  /** serverTimestamp() */
  lastSeenAt: Timestamp;
};

/** アクティブとみなす気配の鮮度。これを過ぎた気配は fetch 側で除外する。 */
const ACTIVE_WINDOW_MS = 15 * 60_000;

/** 一度に取得する気配の上限。ロビー/ホームの一覧表示に十分な件数。 */
const FETCH_LIMIT = 60;

function focusPresenceRef(db: Firestore, uid: string) {
  return doc(db, "focusPresence", uid);
}

function isFocusPresenceMode(value: unknown): value is FocusPresenceMode {
  return value === "stopwatch" || value === "pomodoro";
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * 計測を開始した瞬間に気配を灯す。1 人 1 枚の setDoc(上書き)。
 * best-effort — 失敗しても計測本体には影響させず、console.error のみ。
 */
export async function publishFocusPresence(
  db: Firestore,
  uid: string,
  data: {
    name: string;
    characterColor?: string;
    characterShape?: string;
    subject: string;
    mode: FocusPresenceMode;
    startedAt: number;
  },
): Promise<void> {
  try {
    await setDoc(focusPresenceRef(db, uid), {
      userId: uid,
      name: data.name,
      ...(data.characterColor ? { characterColor: data.characterColor } : {}),
      ...(data.characterShape ? { characterShape: data.characterShape } : {}),
      subject: data.subject,
      mode: data.mode,
      startedAt: data.startedAt,
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[focusPresence] publish failed", error);
  }
}

/**
 * 生存確認だけを更新する(merge)。数分おきに呼ばれる想定。一時停止中も
 * 「席にいる」扱いで呼び続けてよい — 呼ぶかどうかの判断は呼び出し側。
 */
export async function heartbeatFocusPresence(db: Firestore, uid: string): Promise<void> {
  try {
    await setDoc(focusPresenceRef(db, uid), { lastSeenAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("[focusPresence] heartbeat failed", error);
  }
}

/**
 * 計測終了/破棄時に気配を消す。気配は best-effort な機能なので、
 * 失敗しても本体機能(計測終了フロー)を巻き込まないよう握りつぶす。
 */
export async function clearFocusPresence(db: Firestore, uid: string): Promise<void> {
  try {
    await deleteDoc(focusPresenceRef(db, uid));
  } catch (error) {
    console.error("[focusPresence] clear failed", error);
  }
}

/**
 * 直近 15 分以内に生存確認があった気配を最大 60 件取得する。ライブ購読は
 * 使わない(呼び出し側がタイミングを制御する one-shot fetch)。読み取り
 * 失敗時は空配列を返し、呼び出し元の表示を静かに諦めさせる。
 */
export async function fetchActiveFocusPresence(db: Firestore): Promise<FocusPresenceRecord[]> {
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
    const presenceQuery = query(
      collection(db, "focusPresence"),
      where("lastSeenAt", ">", cutoff),
      limit(FETCH_LIMIT),
    );
    const snapshot = await getDocs(presenceQuery);
    const records: FocusPresenceRecord[] = [];
    snapshot.forEach((entry) => {
      const data = entry.data();
      const userId = readString(data.userId);
      const name = readString(data.name);
      const subject = readString(data.subject);
      const mode = data.mode;
      if (!userId || !name || !subject || !isFocusPresenceMode(mode)) {
        return; // 型が壊れているドキュメントは捨てる
      }
      const characterColor = readString(data.characterColor, "");
      const characterShape = readString(data.characterShape, "");
      records.push({
        userId,
        name,
        ...(characterColor ? { characterColor } : {}),
        ...(characterShape ? { characterShape } : {}),
        subject,
        mode,
        startedAt: readNumber(data.startedAt, Date.now()),
        lastSeenAt: data.lastSeenAt instanceof Timestamp ? data.lastSeenAt : Timestamp.now(),
      });
    });
    return records;
  } catch (error) {
    console.error("[focusPresence] fetch failed", error);
    return [];
  }
}
