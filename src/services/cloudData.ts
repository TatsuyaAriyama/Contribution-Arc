import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { guardedOnSnapshot, scheduleDocWrite } from "./firebaseGuard";

export type StudyLogRecord = {
  id: string;
  subject: string;
  minutes: number;
  createdAt: string;
  color?: string;
  learningItemId?: string;
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
  characterShape: string;
  ownedCharacterShapes: string[];
  coins: number;
  lastFeedRewardDate: string;
  feedRewardArcEarned: number;
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
  // Org tenant denormalization. Optional because solo accounts have
  // no organization; undefined for everyone until they create/join one.
  organizationId?: string;
  organizationName?: string;
  organizationRole?: "owner" | "admin" | "member";
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
    learningItemId: log.learningItemId || "",
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

  // Routed through the guard so a transient Firestore error (offline,
  // rules glitch) reconnects with exponential backoff instead of either
  // failing silently or hammering the SDK into a tight retry loop.
  return guardedOnSnapshot<QuerySnapshot>(
    `studyLogs:${userId}`,
    (next, err) => onSnapshot(logsQuery, next, err),
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
            learningItemId: readString(data.learningItemId) || undefined,
          };
        })
        .filter((log) => log.minutes > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      onChange(logs);
    },
    (error) => onError(error),
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

  const payload = {
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
    characterShape: profile.characterShape,
    ownedCharacterShapes: profile.ownedCharacterShapes,
    coins: profile.coins,
    lastFeedRewardDate: profile.lastFeedRewardDate,
    feedRewardArcEarned: profile.feedRewardArcEarned,
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
    // Only write the org fields when the user is actually attached to
    // one — undefined values would shadow the real ones for a moment
    // during the merge write.
    ...(profile.organizationId ? { organizationId: profile.organizationId } : {}),
    ...(profile.organizationName ? { organizationName: profile.organizationName } : {}),
    ...(profile.organizationRole ? { organizationRole: profile.organizationRole } : {}),
  };

  // Build the dedup key from every meaningful field EXCEPT lastSyncedAt
  // (which is regenerated on every caller invocation and would defeat
  // dedup). With this in place a useEffect that re-fires 10 times
  // because of unrelated state churn results in 1 write — not 10.
  const dedupKey = JSON.stringify({
    ...payload,
    lastSyncedAt: undefined,
  });

  // Routed through scheduleDocWrite: this is called from a useEffect
  // with ~15 deps (level, exp, name, avatar, …) so it fires on every
  // study log entry, every avatar tweak, every level-up tick. The
  // guard coalesces a burst into one write.
  await scheduleDocWrite(
    doc(db, "users", profile.uid),
    payload,
    { merge: true },
    { dedupKey },
  );
}

export async function saveGithubActivitySummary(db: Firestore, summary: GitHubActivitySummary) {
  if (!summary.userId || !summary.githubId) {
    return;
  }

  await scheduleDocWrite(
    doc(db, "githubActivities", `${summary.userId}-summary`),
    {
      ...summary,
      type: "summary",
    },
    { merge: true },
    {
      // Same idea as user progress: skip lastSyncedAt from the dedup
      // key so a stable contributionCount doesn't write every run.
      dedupKey: JSON.stringify({
        userId: summary.userId,
        githubId: summary.githubId,
        githubUsername: summary.githubUsername,
        contributionCount: summary.contributionCount,
      }),
    },
  );
}

// =================================================================
// Organization tenant — Phase 1 MVP.
//
// The org concept is the foundation for the B2B layer: SSO, admin
// dashboards, audit logs, and seat-based billing all key off
// `organizationId` on the user profile. This file only ships the
// data plumbing — the UI lives in App.tsx. The matching Firestore
// rules live in firestore.rules under `organizations/` and
// `organizationInvites/`.
// =================================================================

export type OrganizationRecord = {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: string;
  // Phase 3: outbound Slack integration. Empty string / undefined =
  // no integration. The owner manages this from the admin dashboard.
  slackWebhookUrl?: string;
  slackEvents?: {
    roomJoins?: boolean;
    recruitments?: boolean;
    dailyDigest?: boolean;
  };
};

export type OrganizationSlackSettings = {
  slackWebhookUrl: string;
  slackEvents: {
    roomJoins: boolean;
    recruitments: boolean;
    dailyDigest: boolean;
  };
};

/* Audit log entry — Phase 5. One row per org-impacting event so an
   admin can answer 'who did what, when' for compliance reviews
   (security audits, contract renewals, internal HR investigations).
   Stored flat in /auditLogs and filtered by orgId because flat
   collections are easier to administer than per-org subcollections
   when we eventually add retention / export jobs. */
export type AuditLogEventType =
  | "organization.created"
  | "organization.member_joined"
  | "organization.member_left"
  | "organization.slack_updated"
  | "organization.owner_transferred"
  | "room.created";

export type AuditLogRecord = {
  id: string;
  orgId: string;
  type: AuditLogEventType;
  actorUid: string;
  actorName: string;
  /* Human-readable description of *what* was acted on — room name,
     org name, joining member name, etc. Free-form so the row reads
     well in the dashboard without admins having to interpret IDs. */
  target: string;
  /* Optional small payload for richer rendering / future filtering
     (e.g. the room visibility, the slack toggle values). Kept JSON-
     friendly; never put credentials or personal logs here. */
  payload?: Record<string, string | number | boolean>;
  createdAt: string;
};

export async function recordAuditLog(
  db: Firestore,
  entry: Omit<AuditLogRecord, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<void> {
  const id = entry.id || crypto.randomUUID();
  const createdAt = entry.createdAt || new Date().toISOString();
  const record: AuditLogRecord = {
    id,
    orgId: entry.orgId,
    type: entry.type,
    actorUid: entry.actorUid,
    actorName: entry.actorName,
    target: entry.target,
    payload: entry.payload,
    createdAt,
  };
  try {
    await setDoc(doc(db, "auditLogs", id), {
      ...record,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Audit-log failures must never break the underlying user
    // action. Log at info level so observability has the trail
    // even if the write was rejected by rules / offline / quota.
    console.info("audit log write skipped", entry.type, error);
  }
}

/* Transfer organization ownership from the current owner to another
   existing member. Three docs change atomically inside a Firestore
   transaction so the org and both user docs stay consistent even if
   another tab is mutating one of them at the same moment.

   The current owner becomes a regular member; the target becomes
   the new owner. The audit log row is written separately AFTER the
   transaction so the audit-rule's get(users/{currentUid}) check
   still finds the current actor inside the org. */
export async function transferOrganizationOwnership(
  db: Firestore,
  orgId: string,
  currentOwnerUid: string,
  currentOwnerName: string,
  newOwnerUid: string,
  newOwnerName: string,
): Promise<void> {
  if (currentOwnerUid === newOwnerUid) {
    throw new Error("SAME_OWNER");
  }
  await runTransaction(db, async (transaction) => {
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await transaction.get(orgRef);
    if (!orgSnap.exists()) {
      throw new Error("ORG_NOT_FOUND");
    }
    const orgData = orgSnap.data() as Partial<OrganizationRecord>;
    if (orgData.ownerUid !== currentOwnerUid) {
      throw new Error("NOT_CURRENT_OWNER");
    }
    const newOwnerRef = doc(db, "users", newOwnerUid);
    const newOwnerSnap = await transaction.get(newOwnerRef);
    if (!newOwnerSnap.exists()) {
      throw new Error("NEW_OWNER_NOT_FOUND");
    }
    const newOwnerData = newOwnerSnap.data() as Record<string, unknown>;
    if (newOwnerData.organizationId !== orgId) {
      throw new Error("NEW_OWNER_NOT_MEMBER");
    }

    transaction.update(orgRef, { ownerUid: newOwnerUid, updatedAt: serverTimestamp() });
    transaction.set(newOwnerRef, { organizationRole: "owner" }, { merge: true });
    transaction.set(
      doc(db, "users", currentOwnerUid),
      { organizationRole: "member" },
      { merge: true },
    );
  });

  await recordAuditLog(db, {
    orgId,
    type: "organization.owner_transferred",
    actorUid: currentOwnerUid,
    actorName: currentOwnerName,
    target: newOwnerName,
    payload: { newOwnerUid },
  });
}

export async function listAuditLogs(
  db: Firestore,
  orgId: string,
  limitTo = 100,
): Promise<AuditLogRecord[]> {
  // Single equality + client-side sort. Sorting via orderBy would
  // require a composite index; for the dashboard's expected log
  // depth (≤100 entries), the client-side sort is fine.
  const snapshot = await getDocs(query(collection(db, "auditLogs"), where("orgId", "==", orgId)));
  const all = snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    const type =
      data.type === "organization.created" ||
      data.type === "organization.member_joined" ||
      data.type === "organization.member_left" ||
      data.type === "organization.slack_updated" ||
      data.type === "room.created"
        ? (data.type as AuditLogEventType)
        : ("organization.created" as AuditLogEventType);
    return {
      id: typeof data.id === "string" ? data.id : item.id,
      orgId: typeof data.orgId === "string" ? data.orgId : orgId,
      type,
      actorUid: typeof data.actorUid === "string" ? data.actorUid : "",
      actorName: typeof data.actorName === "string" ? data.actorName : "Developer",
      target: typeof data.target === "string" ? data.target : "",
      payload: typeof data.payload === "object" && data.payload !== null
        ? (data.payload as Record<string, string | number | boolean>)
        : undefined,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    } satisfies AuditLogRecord;
  });
  return all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitTo);
}

export async function updateOrganizationSlack(
  db: Firestore,
  orgId: string,
  settings: OrganizationSlackSettings,
  actor: { uid: string; name: string } | null = null,
) {
  await setDoc(
    doc(db, "organizations", orgId),
    {
      slackWebhookUrl: settings.slackWebhookUrl,
      slackEvents: settings.slackEvents,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  if (actor) {
    await recordAuditLog(db, {
      orgId,
      type: "organization.slack_updated",
      actorUid: actor.uid,
      actorName: actor.name,
      target: settings.slackWebhookUrl ? "Slack 連携を更新" : "Slack 連携を解除",
      payload: {
        roomJoins: settings.slackEvents.roomJoins,
        recruitments: settings.slackEvents.recruitments,
        dailyDigest: settings.slackEvents.dailyDigest,
        hasWebhook: Boolean(settings.slackWebhookUrl),
      },
    });
  }
}

export type OrganizationInviteRecord = {
  orgId: string;
  orgName: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  usedBy: string[];
};

export async function createOrganization(
  db: Firestore,
  ownerUid: string,
  ownerName: string,
  name: string,
): Promise<OrganizationRecord> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const record: OrganizationRecord = {
    id,
    name: name.trim(),
    ownerUid,
    createdAt,
  };

  // Three writes, kept separate (not in a transaction) so the rule
  // checks don't have to bridge collections. Order matters:
  //   1. org doc       — rule wants ownerUid == self
  //   2. user doc      — sets organizationId so step 3's audit
  //                       rule can verify membership
  //   3. audit log     — relies on users/{uid}.organizationId
  //                       matching the entry's orgId
  await setDoc(doc(db, "organizations", id), {
    ...record,
    updatedAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "users", ownerUid),
    {
      organizationId: id,
      organizationName: record.name,
      organizationRole: "owner",
    },
    { merge: true },
  );
  await recordAuditLog(db, {
    orgId: id,
    type: "organization.created",
    actorUid: ownerUid,
    actorName: ownerName,
    target: record.name,
  });

  return record;
}

export async function loadOrganization(
  db: Firestore,
  orgId: string,
): Promise<OrganizationRecord | null> {
  const snapshot = await getDoc(doc(db, "organizations", orgId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<OrganizationRecord>;
  if (!data.id || !data.name || !data.ownerUid) return null;
  return {
    id: data.id,
    name: data.name,
    ownerUid: data.ownerUid,
    createdAt: data.createdAt || new Date().toISOString(),
    slackWebhookUrl: typeof data.slackWebhookUrl === "string" ? data.slackWebhookUrl : undefined,
    slackEvents: data.slackEvents
      ? {
          roomJoins: Boolean(data.slackEvents.roomJoins),
          recruitments: Boolean(data.slackEvents.recruitments),
          dailyDigest: Boolean(data.slackEvents.dailyDigest),
        }
      : undefined,
  };
}

export async function leaveOrganization(
  db: Firestore,
  uid: string,
  actor: { name: string; orgId: string; orgName: string } | null = null,
) {
  // Owners can't simply walk away — they'd orphan the org. Caller is
  // responsible for blocking the action; this function just clears
  // the user-side fields. (Future: a Cloud Function will transfer
  // ownership when an owner leaves; for now we forbid in the UI.)
  //
  // The audit log entry is written BEFORE the user doc clear so the
  // membership check in the auditLogs rule still passes — once the
  // organizationId is null the user could no longer record their own
  // departure.
  if (actor) {
    await recordAuditLog(db, {
      orgId: actor.orgId,
      type: "organization.member_left",
      actorUid: uid,
      actorName: actor.name,
      target: actor.orgName,
    });
  }
  await setDoc(
    doc(db, "users", uid),
    {
      organizationId: null,
      organizationName: null,
      organizationRole: null,
    },
    { merge: true },
  );
}

export async function createOrganizationInvite(
  db: Firestore,
  orgId: string,
  orgName: string,
  invitedBy: string,
  options: { ttlDays?: number; maxUses?: number } = {},
): Promise<string> {
  const token = crypto.randomUUID();
  const now = new Date();
  const ttlDays = options.ttlDays ?? 14;
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const record: OrganizationInviteRecord = {
    orgId,
    orgName,
    invitedBy,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    maxUses: options.maxUses ?? 0,
    usedBy: [],
  };
  await setDoc(doc(db, "organizationInvites", token), record);
  return token;
}

/* Snapshot of a single org member for the admin dashboard. Sourced
   from the `users/{uid}` documents — readable by any signed-in user
   under the existing rules, so we don't need to expand the privacy
   surface to ship the dashboard. Individual learning logs / posts
   are deliberately NOT surfaced here; the dashboard is for "team
   investment visibility", not for surveillance. */
export type OrganizationMemberRecord = {
  uid: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  effortExp: number;
  outputExp: number;
  streak: number;
  organizationRole: "owner" | "admin" | "member";
  lastSyncedAt: string;
  contributionCount: number;
};

export async function listOrganizationMembers(
  db: Firestore,
  orgId: string,
): Promise<OrganizationMemberRecord[]> {
  // Single equality query against the org-id field. Firestore needs
  // no composite index for a single-where on a top-level field.
  const snapshot = await getDocs(query(collection(db, "users"), where("organizationId", "==", orgId)));
  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    const roleRaw = data.organizationRole;
    const role: OrganizationMemberRecord["organizationRole"] =
      roleRaw === "owner" || roleRaw === "admin" || roleRaw === "member" ? roleRaw : "member";
    return {
      uid: item.id,
      userId: typeof data.userId === "string" ? data.userId : "",
      displayName: typeof data.displayName === "string" ? data.displayName : "Developer",
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
      level: typeof data.level === "number" ? data.level : 1,
      effortExp: typeof data.effortExp === "number" ? data.effortExp : 0,
      outputExp: typeof data.outputExp === "number" ? data.outputExp : 0,
      streak: typeof data.streak === "number" ? data.streak : 0,
      organizationRole: role,
      lastSyncedAt: typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : "",
      contributionCount: typeof data.contributionCount === "number" ? data.contributionCount : 0,
    };
  });
}

export async function acceptOrganizationInvite(
  db: Firestore,
  token: string,
  uid: string,
  actorName: string = "Developer",
): Promise<OrganizationRecord> {
  // Transaction: read invite + org, validate, append uid to usedBy,
  // update user's organizationId. Keeps the maxUses cap honest under
  // concurrent claims. The audit log write happens *after* the
  // transaction succeeds so the auditLogs rule's get(users/{uid})
  // check finds the freshly-set organizationId.
  const result = await runTransaction(db, async (transaction) => {
    const inviteRef = doc(db, "organizationInvites", token);
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error("INVITE_NOT_FOUND");
    }
    const invite = inviteSnap.data() as OrganizationInviteRecord;
    const now = new Date();
    if (new Date(invite.expiresAt).getTime() < now.getTime()) {
      throw new Error("INVITE_EXPIRED");
    }
    const usedBy = Array.isArray(invite.usedBy) ? invite.usedBy : [];
    if (invite.maxUses > 0 && usedBy.length >= invite.maxUses) {
      throw new Error("INVITE_EXHAUSTED");
    }

    const orgRef = doc(db, "organizations", invite.orgId);
    const orgSnap = await transaction.get(orgRef);
    if (!orgSnap.exists()) {
      throw new Error("ORG_NOT_FOUND");
    }
    const orgData = orgSnap.data() as OrganizationRecord;

    const userRef = doc(db, "users", uid);
    const nextUsedBy = usedBy.includes(uid) ? usedBy : [...usedBy, uid];
    transaction.update(inviteRef, { usedBy: nextUsedBy });
    transaction.set(
      userRef,
      {
        organizationId: invite.orgId,
        organizationName: invite.orgName,
        organizationRole: "member",
      },
      { merge: true },
    );

    return {
      id: orgData.id || invite.orgId,
      name: orgData.name || invite.orgName,
      ownerUid: orgData.ownerUid,
      createdAt: orgData.createdAt || new Date().toISOString(),
    };
  });

  await recordAuditLog(db, {
    orgId: result.id,
    type: "organization.member_joined",
    actorUid: uid,
    actorName: actorName,
    target: result.name,
  });

  return result;
}
