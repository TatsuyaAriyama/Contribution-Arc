import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

export type StudyLogRecord = {
  id: string;
  subject: string;
  minutes: number;
  createdAt: string;
  color?: string;
};

export type WorkspaceSessionRecord = {
  id: string;
  userId: string;
  roomId: string;
  roomName?: string;
  task: string;
  joinedAt: string;
  leftAt: string;
  durationMinutes: number;
  earnedExp: number;
};

export type UserProgressRecord = {
  uid: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  photoURL: string;
  level: number;
  effortExp: number;
  outputExp: number;
  currentTitle: string;
  currentCharacter: string;
  characterColor: string;
  streak: number;
  determination: string;
  following: string[];
  followers?: string[];
  unlockedCharacters: string[];
  characterExp: number;
  openedWorkspaceGiftLevels: number[];
  githubId: string;
  githubUsername: string;
  contributionCount: number;
  lastSyncedAt: string;
};

export type GitHubActivitySummary = {
  userId: string;
  githubId: string;
  githubUsername: string;
  contributionCount: number;
  lastSyncedAt: string;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function studyLogToCloudPayload(
  userId: string,
  log: StudyLogRecord,
  options: { roomId?: string; earnedExp?: number; source?: string } = {},
) {
  return {
    userId,
    roomId: options.roomId || "",
    category: log.subject,
    subject: log.subject,
    studyMinutes: log.minutes,
    minutes: log.minutes,
    earnedExp: options.earnedExp ?? Math.round(log.minutes * 1.25),
    createdAt: log.createdAt,
    color: log.color || "",
    source: options.source || "manual",
    updatedAt: serverTimestamp(),
  };
}

export function subscribeStudyLogsFromCloud(
  db: Firestore,
  userId: string,
  onChange: (logs: StudyLogRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const logsQuery = query(collection(db, "studyLogs"), where("userId", "==", userId));

  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const logs = snapshot.docs
        .map((item) => {
          const data = item.data();
          const minutes = readNumber(data.studyMinutes, readNumber(data.minutes));

          return {
            id: item.id,
            subject: readString(data.category, readString(data.subject, "Deep Work")),
            minutes,
            createdAt: readCreatedAt(data.createdAt),
            color: readString(data.color),
          };
        })
        .filter((log) => log.minutes > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      onChange(logs);
    },
    onError,
  );
}

export async function saveStudyLogToCloud(
  db: Firestore,
  userId: string,
  log: StudyLogRecord,
  options: { roomId?: string; earnedExp?: number; source?: string } = {},
) {
  await setDoc(doc(db, "studyLogs", log.id), studyLogToCloudPayload(userId, log, options), { merge: true });
}

export async function migrateStudyLogsToCloud(db: Firestore, userId: string, logs: StudyLogRecord[]) {
  const cleanLogs = logs.filter((log) => log.id && log.minutes > 0 && log.subject.trim());
  const chunkSize = 400;

  for (let index = 0; index < cleanLogs.length; index += chunkSize) {
    const batch = writeBatch(db);
    cleanLogs.slice(index, index + chunkSize).forEach((log) => {
      batch.set(
        doc(db, "studyLogs", log.id),
        {
          ...studyLogToCloudPayload(userId, log, { source: "localStorage-migration" }),
          migratedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
}

export async function deleteStudyLogFromCloud(db: Firestore, logId: string) {
  await deleteDoc(doc(db, "studyLogs", logId));
}

export async function saveWorkspaceSessionToCloud(db: Firestore, session: WorkspaceSessionRecord) {
  await setDoc(
    doc(db, "workspaceSessions", session.id),
    {
      userId: session.userId,
      roomId: session.roomId,
      roomName: session.roomName || "",
      currentTask: session.task,
      task: session.task,
      joinedAt: session.joinedAt,
      leftAt: session.leftAt,
      durationMinutes: session.durationMinutes,
      earnedExp: session.earnedExp,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveUserProgressToCloud(db: Firestore, profile: UserProgressRecord) {
  if (!profile.userId) {
    return;
  }

  await setDoc(
    doc(db, "users", profile.uid),
    {
      uid: profile.uid,
      userId: profile.userId,
      displayName: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      photoURL: profile.photoURL,
      searchName: profile.displayName.toLowerCase(),
      level: profile.level,
      effortExp: profile.effortExp,
      outputExp: profile.outputExp,
      currentTitle: profile.currentTitle,
      currentCharacter: profile.currentCharacter,
      characterColor: profile.characterColor,
      streak: profile.streak,
      determination: profile.determination,
      following: profile.following,
      ...(profile.followers && profile.followers.length > 0 ? { followers: profile.followers } : {}),
      unlockedCharacters: profile.unlockedCharacters,
      characterExp: profile.characterExp,
      openedWorkspaceGiftLevels: profile.openedWorkspaceGiftLevels,
      githubId: profile.githubId,
      githubUsername: profile.githubUsername,
      contributionCount: profile.contributionCount,
      lastSyncedAt: profile.lastSyncedAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveGithubActivitySummary(db: Firestore, summary: GitHubActivitySummary) {
  if (!summary.userId || !summary.githubId) {
    return;
  }

  await setDoc(
    doc(db, "githubActivities", `${summary.userId}-summary`),
    {
      ...summary,
      type: "summary",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
