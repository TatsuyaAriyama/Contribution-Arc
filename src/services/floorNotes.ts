import {
  collection,
  deleteDoc,
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

/* 置き手紙 (floor note) — a short message a member leaves on the room
   floor. Lives under `workspaceRooms/{roomId}/notes`. `expiresAt` is an
   ISO timestamp ~24h out; clients hide expired notes and the author (or
   the next writer) lazily deletes them, so there's no scheduled cleanup. */
export type FloorNoteRecord = {
  id: string;
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  text: string;
  createdAt: string;
  expiresAt: string;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function subscribeFloorNotes(
  db: Firestore,
  roomId: string,
  onChange: (notes: FloorNoteRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const notesQuery = query(
    collection(db, "workspaceRooms", roomId, "notes"),
    orderBy("createdAt", "desc"),
    limit(30),
  );

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      const now = Date.now();
      const notes = snapshot.docs
        .map((item) => {
          const data = item.data();
          return {
            id: item.id,
            userId: readString(data.userId),
            name: readString(data.name, "Developer"),
            color: readString(data.color, ""),
            x: readNumber(data.x, 50),
            y: readNumber(data.y, 50),
            text: readString(data.text),
            createdAt: readString(data.createdAt),
            expiresAt: readString(data.expiresAt),
          } satisfies FloorNoteRecord;
        })
        .filter(
          (note) =>
            note.userId &&
            note.text.trim() &&
            (!note.expiresAt || new Date(note.expiresAt).getTime() > now),
        );
      onChange(notes);
    },
    onError,
  );
}

export async function saveFloorNote(db: Firestore, roomId: string, note: FloorNoteRecord) {
  await setDoc(doc(db, "workspaceRooms", roomId, "notes", note.id), {
    ...note,
    serverCreatedAt: serverTimestamp(),
  });
}

export async function deleteFloorNote(db: Firestore, roomId: string, noteId: string) {
  await deleteDoc(doc(db, "workspaceRooms", roomId, "notes", noteId));
}
