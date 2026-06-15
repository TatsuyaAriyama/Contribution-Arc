/**
 * アトリエ (ルーム) 内チャット — Firestore 経由のシンプルなメッセージ機構。
 *
 * 構造: rooms/{roomId}/chat/{messageId}
 *  ↑ App.tsx の workspaceRoomsCollectionName ("rooms") と一致。
 *  最初実装で workspaceRooms/{roomId}/chat に書こうとしてしまい、
 *  permission-denied で「送信に失敗しました」になっていた経緯あり。
 *  最新 50 件を購読 (orderBy createdAt desc, limit 50)
 *  クライアントから NG ワードを含むメッセージは弾く (containsBlockedWord)
 *
 * Firestore rules: rooms/{roomId}/chat/{messageId} の create は本人 uid
 *  のみ、read は signedIn。 (firestore.rules で設定)
 */

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

/** App.tsx の workspaceRoomsCollectionName と一致させる。 */
const ROOMS_COLLECTION = "rooms";

export type RoomChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  characterColor?: string;
  characterShape?: string;
  text: string;
  createdAt: string;
};

const MESSAGES_LIMIT = 50;

export function subscribeRoomChat(
  db: Firestore,
  roomId: string,
  onChange: (messages: RoomChatMessage[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(
    collection(db, ROOMS_COLLECTION, roomId, "chat"),
    orderBy("createdAt", "desc"),
    limit(MESSAGES_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      const messages: RoomChatMessage[] = snap.docs.map((d) => {
        const data = d.data() as Partial<RoomChatMessage>;
        return {
          id: d.id,
          roomId,
          userId: typeof data.userId === "string" ? data.userId : "",
          userName: typeof data.userName === "string" ? data.userName : "",
          characterColor:
            typeof data.characterColor === "string" ? data.characterColor : undefined,
          characterShape:
            typeof data.characterShape === "string" ? data.characterShape : undefined,
          text: typeof data.text === "string" ? data.text : "",
          createdAt:
            typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        };
      });
      // newest → oldest で取得しているので表示用に逆順にする
      onChange(messages.reverse());
    },
    (err) => onError?.(err),
  );
}

export async function sendRoomChatMessage(
  db: Firestore,
  message: Omit<RoomChatMessage, "id" | "createdAt"> & { id?: string },
): Promise<void> {
  const id = message.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`);
  const ref = doc(db, ROOMS_COLLECTION, message.roomId, "chat", id);
  await setDoc(
    ref,
    {
      ...message,
      id,
      createdAt: new Date().toISOString(),
      serverCreatedAt: serverTimestamp(),
    },
    { merge: false },
  );
}

/**
 * 最小限の不適切ワードフィルタ。日本語 / 英語の代表的な悪口を入口で弾く。
 * 完璧ではないが、誰でも書けるチャットの最低限のガード。
 * NG ワードを増やすときはこの配列に追加する。
 */
const BLOCKED_WORDS = [
  // 日本語 (差別 / 攻撃 / 性的)
  "死ね",
  "殺す",
  "ぶっ殺",
  "くたばれ",
  "クズ",
  "ゴミ",
  "ばか",
  "馬鹿",
  "アホ",
  "あほ",
  "クソ",
  "くそ",
  "うざい",
  "きもい",
  "キモい",
  // 英語
  "fuck",
  "shit",
  "asshole",
  "bitch",
  "cunt",
  "dick",
  "fag",
  "nigger",
  "retard",
  "kill yourself",
  "kys",
];

function normalizeForFilter(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]+/g, "");
}

export function containsBlockedWord(text: string): boolean {
  const normalized = normalizeForFilter(text);
  return BLOCKED_WORDS.some((w) => normalized.includes(normalizeForFilter(w)));
}
