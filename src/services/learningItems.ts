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

export type LearningItemRecord = {
  id: string;
  userId: string;
  name: string;
  category: LearningCategory;
  color: string;
  totalPages?: number;
  currentPages?: number;
  note?: string;
  archived: boolean;
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
      return {
        id: entry.id,
        userId: readString(data.userId, userId),
        name: readString(data.name, "未設定"),
        category: readCategory(data.category),
        color: readString(data.color, "#888"),
        totalPages,
        currentPages,
        ...(note ? { note } : {}),
        archived: Boolean(data.archived),
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
  await setDoc(doc(db, "learningItems", item.id), payload, { merge: true });
}

export async function deleteLearningItemFromCloud(db: Firestore, itemId: string) {
  await deleteDoc(doc(db, "learningItems", itemId));
}
