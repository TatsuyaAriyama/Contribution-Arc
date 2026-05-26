import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

export type WorkspaceRecruitmentRecord = {
  id: string;
  userId: string;
  roomId: string;
  roomName: string;
  task: string;
  message: string;
  durationMinutes: number;
  createdAt: string;
  startAt: string;
  expiresAt: string;
  joinedUserIds: string[];
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

export function subscribeActiveRecruitmentsFromCloud(
  db: Firestore,
  onChange: (recruitments: WorkspaceRecruitmentRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const nowIso = new Date().toISOString();
  // We can't easily do range query across multiple fields with Firestore.
  // Subscribe to all expiring after "now" and filter client-side.
  // Defensive limit(50): in normal operation we expect at most a handful
  // of live recruitments — capping prevents a runaway write loop or stale
  // data from blowing up reads. The timeline only renders the top entries
  // anyway.
  const recruitmentsQuery = query(
    collection(db, "workspaceRecruitments"),
    where("expiresAt", ">", nowIso),
    limit(50),
  );

  return onSnapshot(
    recruitmentsQuery,
    (snapshot) => {
      const recruitments = snapshot.docs
        .map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            userId: readString(data.userId),
            roomId: readString(data.roomId),
            roomName: readString(data.roomName),
            task: readString(data.task),
            message: readString(data.message),
            durationMinutes: readNumber(data.durationMinutes, 60),
            createdAt: readCreatedAt(data.createdAt),
            startAt: readCreatedAt(data.startAt),
            expiresAt: readCreatedAt(data.expiresAt),
            joinedUserIds: readStringList(data.joinedUserIds),
          } satisfies WorkspaceRecruitmentRecord;
        })
        .filter((entry) => entry.userId && entry.roomId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      onChange(recruitments);
    },
    onError,
  );
}

export async function createRecruitmentInCloud(db: Firestore, recruitment: WorkspaceRecruitmentRecord) {
  await setDoc(doc(db, "workspaceRecruitments", recruitment.id), {
    userId: recruitment.userId,
    roomId: recruitment.roomId,
    roomName: recruitment.roomName,
    task: recruitment.task,
    message: recruitment.message,
    durationMinutes: recruitment.durationMinutes,
    createdAt: recruitment.createdAt,
    startAt: recruitment.startAt,
    expiresAt: recruitment.expiresAt,
    joinedUserIds: recruitment.joinedUserIds,
    updatedAt: serverTimestamp(),
  });
}

export async function joinRecruitmentInCloud(db: Firestore, recruitmentId: string, userId: string) {
  await updateDoc(doc(db, "workspaceRecruitments", recruitmentId), {
    joinedUserIds: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelRecruitmentInCloud(db: Firestore, recruitmentId: string) {
  await deleteDoc(doc(db, "workspaceRecruitments", recruitmentId));
}
