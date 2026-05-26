import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { guardedOnSnapshot } from "./firebaseGuard";

export type LearningCategory = "book" | "stack";

export type LearningItemRecord = {
  id: string;
  userId: string;
  name: string;
  category: LearningCategory;
  color: string;
  totalPages?: number;
  currentPages?: number;
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

export function subscribeLearningItemsFromCloud(
  db: Firestore,
  userId: string,
  onChange: (items: LearningItemRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const itemsQuery = query(collection(db, "learningItems"), where("userId", "==", userId));

  return guardedOnSnapshot<QuerySnapshot>(
    `learningItems:${userId}`,
    (next, err) => onSnapshot(itemsQuery, next, err),
    (snapshot) => {
      const items = snapshot.docs
        .map((entry) => {
          const data = entry.data();
          const totalPages = readNumber(data.totalPages);
          const currentPages = readNumber(data.currentPages);
          return {
            id: entry.id,
            userId: readString(data.userId, userId),
            name: readString(data.name, "未設定"),
            category: readCategory(data.category),
            color: readString(data.color, "#888"),
            totalPages,
            currentPages,
            archived: Boolean(data.archived),
            createdAt: readCreatedAt(data.createdAt),
            updatedAt: readCreatedAt(data.updatedAt),
          } satisfies LearningItemRecord;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      onChange(items);
    },
    (error) => onError(error),
  );
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
  await setDoc(doc(db, "learningItems", item.id), payload, { merge: true });
}

export async function deleteLearningItemFromCloud(db: Firestore, itemId: string) {
  await deleteDoc(doc(db, "learningItems", itemId));
}
