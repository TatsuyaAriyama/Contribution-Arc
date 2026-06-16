import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
  type QuerySnapshot,
} from "firebase/firestore";

export type LearningCategory = "book" | "stack";

export type LearningStatus = "active" | "done" | "paused";

export type LearningItemRecord = {
  id: string;
  userId: string;
  name: string;
  category: LearningCategory;
  color: string;
  totalPages?: number;
  currentPages?: number;
  note?: string;
  /** ユーザーがアップロードした表紙/アイコン写真。クライアント側で
   *  正方形 144px JPEG に圧縮した data URL (~10-25KB)。Firebase Storage
   *  を使わず Firestore doc に直接入れる (1MB 上限に対して十分小さい)。 */
  photo?: string;
  status: LearningStatus;
  archived: boolean;
  /** ユーザーが手動で並べ替えた順序 (custom sort)。小さいほど上に来る。
   *  未設定 (古いユーザー) は createdAt fallback で並ぶ。 */
  order?: number;
  createdAt: string;
  updatedAt: string;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readCategory(value: unknown): LearningCategory {
  return value === "book" ? "book" : "stack";
}

function readStatus(value: unknown): LearningStatus {
  return value === "done" || value === "paused" ? value : "active";
}

function readCreatedAt(value: unknown) {
  if (typeof value === "string" && value) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapLearningItemDocs(snapshot: QuerySnapshot, userId: string): LearningItemRecord[] {
  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      const totalPages = readNumber(data.totalPages);
      const currentPages = readNumber(data.currentPages);
      const note = readString(data.note);
      const photo = readString(data.photo);
      return {
        id: entry.id,
        userId: readString(data.userId, userId),
        name: readString(data.name, "未設定"),
        category: readCategory(data.category),
        color: readString(data.color, "#888"),
        totalPages,
        currentPages,
        ...(note ? { note } : {}),
        ...(photo ? { photo } : {}),
        status: readStatus(data.status),
        archived: Boolean(data.archived),
        ...(typeof data.order === "number" && Number.isFinite(data.order) ? { order: data.order } : {}),
        createdAt: readCreatedAt(data.createdAt),
        updatedAt: readCreatedAt(data.updatedAt),
      } satisfies LearningItemRecord;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * One-time fetch of the signed-in user's learning items.
 *
 * Learning items are only ever edited by their owner, and every local
 * mutation (add / edit / archive / delete) already updates React state
 * optimistically before writing to Firestore. A live `onSnapshot` would
 * therefore only echo back changes the client already applied — pure
 * read cost for no UX gain — so we read once on load instead. Cross-device
 * edits surface on the next reload, which is acceptable for solo-owned data.
 */
export async function fetchLearningItemsFromCloud(
  db: Firestore,
  userId: string,
): Promise<LearningItemRecord[]> {
  const itemsQuery = query(collection(db, "learningItems"), where("userId", "==", userId));
  const snapshot = await getDocs(itemsQuery);
  return mapLearningItemDocs(snapshot, userId);
}

export async function saveLearningItemToCloud(db: Firestore, item: LearningItemRecord) {
  const payload: Record<string, unknown> = {
    userId: item.userId,
    name: item.name,
    category: item.category,
    color: item.color,
    status: item.status,
    archived: item.archived,
    createdAt: item.createdAt,
    updatedAt: serverTimestamp(),
  };
  if (typeof item.totalPages === "number") {
    payload.totalPages = item.totalPages;
  }
  if (typeof item.currentPages === "number") {
    payload.currentPages = item.currentPages;
  }
  // Always write note (even empty) so clearing it propagates — with
  // merge:true an omitted field would leave the stale value in place.
  payload.note = typeof item.note === "string" ? item.note.trim().slice(0, 280) : "";
  // photo も同じ理由で常に書く (空 = 削除を反映)。data URL は
  // クライアント側で圧縮済みの前提だが、安全側で 200KB を超える文字列は
  // 落とす (Firestore doc 1MB 制限のガード)。
  payload.photo =
    typeof item.photo === "string" && item.photo.length <= 200_000 ? item.photo : "";
  if (typeof item.order === "number" && Number.isFinite(item.order)) {
    payload.order = item.order;
  }
  await setDoc(doc(db, "learningItems", item.id), payload, { merge: true });
}

export async function deleteLearningItemFromCloud(db: Firestore, itemId: string) {
  await deleteDoc(doc(db, "learningItems", itemId));
}
