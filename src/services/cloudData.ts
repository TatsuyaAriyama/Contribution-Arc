import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  orderBy,
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
import { normalizePlanTier, type PlanTier } from "./plans";

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
  /* 日報報酬：今日やること + 振り返り の両方を当日中に書き切った日付。
     PC ↔ モバイル間で同一日に二重に受け取れないよう、最後に受領した
     YYYY-MM-DD を持つ。Optional は back-compat（旧プロファイル）用。 */
  lastDailyReportRewardDate?: string;
  /* Poker chips — separated from Arc so the casino loop doesn't
     inflate the spend-side currency. Optional for back-compat with
     profiles created before poker shipped. */
  pokerChips?: number;
  focusChips?: number;
  /* YYYY-MM-DD of the day the focus chip counters were last reset. */
  focusChipsDate?: string;
  /* `currentStayMinutes` snapshot at the last focus-chip grant, so we
     award one chip every 25 stayed minutes without double-counting. */
  focusStayMinutesSnapshot?: number;
  streak: number;
  determination: string;
  goalId?: string;
  goalCustomName?: string;
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
  /* Sunday-start week minutes for the leaderboard (mirrored in the
     profile doc so friends don't need a query per user). */
  weekMinutes?: number;
  weekKey?: string;
  /* Cross-device sync fields. すべて optional で、未設定なら旧
     localStorage 限定動作にフォールバックする (後方互換)。
     - language: i18n の "ja" / "en" 等。スマホで切り替えた言語を PC
       に持っていく
     - onboardingCompletedAt: チュートリアル完了 ISO timestamp。
       新規デバイスで再開させないための旗
     - pinnedFriendUids / mutedFriendUids / blockedFriendUids: 友達の
       ピン・ミュート・ブロック (ブロックは安全機能なので片方の端末
       だけ効くのは事故になるため必ず同期) */
  language?: string;
  onboardingCompletedAt?: string;
  pinnedFriendUids?: string[];
  mutedFriendUids?: string[];
  blockedFriendUids?: string[];
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

type StudyLogWriteOptions = {
  roomId?: string;
  earnedExp?: number;
  source?: string;
  /* Org tenant stamp. When the author belongs to an organization we
     write its id onto every log so the org owner's Manager Dashboard
     can run team-wide aggregation and per-member drill-down with a
     single org-scoped query (see firestore.rules studyLogs read). Solo
     accounts omit it, keeping their logs fully private. */
  organizationId?: string;
};

function studyLogToCloudPayload(
  userId: string,
  log: StudyLogRecord,
  options: StudyLogWriteOptions = {},
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
    ...(options.organizationId ? { organizationId: options.organizationId } : {}),
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
  options: StudyLogWriteOptions = {},
) {
  await setDoc(doc(db, "studyLogs", log.id), studyLogToCloudPayload(userId, log, options), { merge: true });
}

export async function migrateStudyLogsToCloud(
  db: Firestore,
  userId: string,
  logs: StudyLogRecord[],
  options: { organizationId?: string } = {},
) {
  const cleanLogs = logs.filter((log) => log.id && log.minutes > 0 && log.subject.trim());
  const chunkSize = 400;

  for (let index = 0; index < cleanLogs.length; index += chunkSize) {
    const batch = writeBatch(db);
    cleanLogs.slice(index, index + chunkSize).forEach((log) => {
      batch.set(
        doc(db, "studyLogs", log.id),
        {
          ...studyLogToCloudPayload(userId, log, {
            source: "localStorage-migration",
            organizationId: options.organizationId,
          }),
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

/* A study log enriched with its author id, for org-scoped reads where
   the Manager Dashboard needs to group by member. The personal app
   never needs userId (every log is the current user's), so it's kept
   off StudyLogRecord and only added here. */
export type OrgStudyLogRecord = StudyLogRecord & { userId: string };

function mapStudyLogDoc(id: string, data: Record<string, unknown>): OrgStudyLogRecord {
  const minutes = readNumber(data.studyMinutes, readNumber(data.minutes));
  return {
    id,
    userId: readString(data.userId),
    subject: readString(data.category, readString(data.subject, "Deep Work")),
    minutes,
    createdAt: readCreatedAt(data.createdAt),
    color: readString(data.color),
    learningItemId: readString(data.learningItemId) || undefined,
  };
}

/* Manager Dashboard — per-member drill-down. Reads one member's logs,
   scoped to the org so the firestore.rules org-owner branch authorizes
   the query (the org filter is mandatory: "rules are not filters").
   Sorted/sliced server-side via the (organizationId, userId, createdAt)
   composite index; capped so a prolific member can't balloon the read.
   Logs predating the org-stamping rollout lack organizationId and are
   intentionally excluded. */
export async function listMemberStudyLogs(
  db: Firestore,
  orgId: string,
  memberUid: string,
  max = 400,
): Promise<StudyLogRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "studyLogs"),
      where("organizationId", "==", orgId),
      where("userId", "==", memberUid),
      orderBy("createdAt", "desc"),
      queryLimit(max),
    ),
  );
  return snapshot.docs
    .map((item) => mapStudyLogDoc(item.id, item.data() as Record<string, unknown>))
    .filter((log) => log.minutes > 0);
}

/* Manager Dashboard — team-wide aggregation. One windowed query across
   every member's logs in the org since `sinceIso`, ordered + capped via
   the (organizationId, createdAt) composite index. The caller derives
   team trend / heatmap / genre breakdown from the returned logs. The
   window + limit keep this a bounded read regardless of org size. */
export async function fetchOrganizationStudyLogs(
  db: Firestore,
  orgId: string,
  sinceIso: string,
  max = 3000,
): Promise<OrgStudyLogRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "studyLogs"),
      where("organizationId", "==", orgId),
      where("createdAt", ">=", sinceIso),
      orderBy("createdAt", "desc"),
      queryLimit(max),
    ),
  );
  return snapshot.docs
    .map((item) => mapStudyLogDoc(item.id, item.data() as Record<string, unknown>))
    .filter((log) => log.minutes > 0);
}

/* One-time, member-side backfill: stamp the member's own pre-rollout
   logs with their current organizationId so the Manager Dashboard's
   history (drill-down + team trend) reaches back beyond the rollout
   date instead of starting empty. Runs under the author's own
   credentials (self-update is always allowed), and is guarded by the
   caller with a localStorage marker so it executes at most once per
   (user, org) — honoring the project's write-dedup discipline. Returns
   how many logs were stamped. */
export async function backfillStudyLogOrganizationId(
  db: Firestore,
  userId: string,
  orgId: string,
): Promise<number> {
  const snapshot = await getDocs(query(collection(db, "studyLogs"), where("userId", "==", userId)));
  const stale = snapshot.docs.filter((item) => {
    const value = (item.data() as Record<string, unknown>).organizationId;
    return typeof value !== "string" || value.length === 0;
  });
  if (stale.length === 0) {
    return 0;
  }

  const chunkSize = 400;
  for (let index = 0; index < stale.length; index += chunkSize) {
    const batch = writeBatch(db);
    stale.slice(index, index + chunkSize).forEach((item) => {
      batch.set(doc(db, "studyLogs", item.id), { organizationId: orgId, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  return stale.length;
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

/* The two appearance fields the feed/report avatars care about. */
export type AuthorAppearance = {
  characterShape: string;
  characterColor: string;
};

/* Live appearance lookup for feed / reply / daily-report avatars.

   Posts, replies and daily reports each snapshot the author's
   character color at write time and never recorded the character
   *shape* at all — so historically every feed avatar rendered as the
   default silhouette in whatever color was equipped that day, and went
   stale the moment the author re-skinned. We instead want the avatar to
   mirror the author's *currently equipped* character + color.

   This pulls the author's `users/{uid}` profile (any signed-in user may
   read it per the Firestore rules) and returns just the two appearance
   fields. Reads are batched with `documentId() in` (chunks of 10, the
   `in` limit) so a feed full of distinct authors costs a handful of
   reads rather than one per post. Callers cache the result per session,
   so a given author is fetched at most once — keeping this comfortably
   inside the free tier. */
export async function fetchAuthorAppearances(
  db: Firestore,
  userIds: string[],
): Promise<Record<string, AuthorAppearance>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return {};

  const result: Record<string, AuthorAppearance> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) {
    chunks.push(unique.slice(i, i + 10));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snapshot = await getDocs(
          query(collection(db, "users"), where(documentId(), "in", chunk)),
        );
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          result[docSnap.id] = {
            characterShape:
              typeof data.characterShape === "string" ? data.characterShape : "default",
            characterColor:
              typeof data.characterColor === "string" ? data.characterColor : "",
          };
        });
      } catch {
        // A single chunk failing (rules / transient network) shouldn't
        // blank the rest — the per-record snapshot color is the fallback
        // for any id we couldn't resolve here.
      }
    }),
  );

  return result;
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
    ...(profile.lastDailyReportRewardDate
      ? { lastDailyReportRewardDate: profile.lastDailyReportRewardDate }
      : {}),
    ...(profile.pokerChips !== undefined ? { pokerChips: profile.pokerChips } : {}),
    ...(profile.focusChips !== undefined ? { focusChips: profile.focusChips } : {}),
    ...(profile.focusChipsDate ? { focusChipsDate: profile.focusChipsDate } : {}),
    ...(profile.focusStayMinutesSnapshot !== undefined
      ? { focusStayMinutesSnapshot: profile.focusStayMinutesSnapshot }
      : {}),
    streak: profile.streak,
    determination: profile.determination,
    // 目標 (空文字は cloud 側の既存値を消すため、未指定 = 空文字を書く)
    goalId: typeof profile.goalId === "string" ? profile.goalId : "",
    goalCustomName: typeof profile.goalCustomName === "string" ? profile.goalCustomName : "",
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
    // Cross-device 同期フィールド。値が空 / 未設定なら書かない (merge
    // で残っている cloud 側の値を消さないため)。
    ...(typeof profile.weekMinutes === "number" ? { weekMinutes: profile.weekMinutes } : {}),
    ...(profile.weekKey ? { weekKey: profile.weekKey } : {}),
    ...(profile.language ? { language: profile.language } : {}),
    ...(profile.onboardingCompletedAt ? { onboardingCompletedAt: profile.onboardingCompletedAt } : {}),
    ...(Array.isArray(profile.pinnedFriendUids) ? { pinnedFriendUids: profile.pinnedFriendUids } : {}),
    ...(Array.isArray(profile.mutedFriendUids) ? { mutedFriendUids: profile.mutedFriendUids } : {}),
    ...(Array.isArray(profile.blockedFriendUids) ? { blockedFriendUids: profile.blockedFriendUids } : {}),
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
  // 契約プラン。更新するのはサーバ(Stripe webhook を受ける Cloud
  // Function 等)だけで、クライアントからは read-only として扱う
  // (= UI から自己アップグレードさせない)。未設定は "free" 扱い。
  // 詳細は src/services/plans.ts を参照。
  planTier?: PlanTier;
  // Phase 3: outbound Slack integration. Empty string / undefined =
  // no integration. The owner manages this from the admin dashboard.
  // Phase 9 expanded the event taxonomy — older docs that only
  // carry the original three booleans still work fine since the
  // new fields are optional.
  slackWebhookUrl?: string;
  slackEvents?: {
    roomJoins?: boolean;
    roomLeaves?: boolean;
    breakStarted?: boolean;
    recruitments?: boolean;
    posts?: boolean;
    dailyDigest?: boolean;
  };
  // Phase 7: domain auto-join. If a signed-in user's email domain
  // appears in this list and they don't already belong to any org,
  // the home dashboard surfaces a one-tap join CTA. Stored as an
  // array so a single org can cover multiple domains (acme.com +
  // acme.jp etc.).
  autoJoinDomains?: string[];
};

export type OrganizationSlackSettings = {
  slackWebhookUrl: string;
  slackEvents: {
    roomJoins: boolean;
    roomLeaves: boolean;
    breakStarted: boolean;
    recruitments: boolean;
    posts: boolean;
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
  | "organization.member_removed"
  | "organization.slack_updated"
  | "organization.owner_transferred"
  | "organization.team_updated"
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
      data.type === "organization.member_removed" ||
      data.type === "organization.slack_updated" ||
      data.type === "organization.owner_transferred" ||
      data.type === "organization.team_updated" ||
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
    // 新規組織は free から。アップグレードは Stripe Checkout 経由で
    // サーバが planTier を書き換える(クライアントは触らない)。
    planTier: "free",
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

/* Update the auto-join domains for an org. Owner-only at the rule
   level. Empty array clears the policy. Domain strings are stored
   lowercased + trimmed; validation happens in the caller. */
export async function updateOrganizationDomains(
  db: Firestore,
  orgId: string,
  domains: string[],
  actor: { uid: string; name: string } | null = null,
) {
  const normalised = Array.from(
    new Set(
      domains
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value)),
    ),
  );
  await setDoc(
    doc(db, "organizations", orgId),
    {
      autoJoinDomains: normalised,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  if (actor) {
    await recordAuditLog(db, {
      orgId,
      type: "organization.slack_updated",
      // Re-use the slack_updated event type for now — the audit log
      // surface treats both as "settings changed". A dedicated
      // domain_updated event can be added later if procurement asks.
      actorUid: actor.uid,
      actorName: actor.name,
      target: normalised.length > 0 ? `ドメイン: ${normalised.join(", ")}` : "ドメイン自動参加を解除",
    });
  }
}

/* Find orgs that have opted into auto-join for a given email domain.
   The caller already has the email; we only pass the domain part so
   the personal-data surface stays small. Capped at a small number
   client-side because realistic apps with a real domain match should
   surface 1-2 orgs at most; >5 implies misconfiguration. */
export async function findOrganizationsByEmailDomain(
  db: Firestore,
  domain: string,
): Promise<OrganizationRecord[]> {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return [];
  const snapshot = await getDocs(
    query(collection(db, "organizations"), where("autoJoinDomains", "array-contains", trimmed)),
  );
  return snapshot.docs
    .map((item) => {
      const data = item.data() as Partial<OrganizationRecord>;
      if (!data.name || !data.ownerUid) return null;
      return {
        id: data.id || item.id,
        name: data.name,
        ownerUid: data.ownerUid,
        createdAt: data.createdAt || new Date().toISOString(),
      } satisfies OrganizationRecord;
    })
    .filter((value): value is OrganizationRecord => value !== null)
    .slice(0, 5);
}

/* Join an org via domain auto-discovery. Different shape from the
   invite-link flow: there's no token to consume, just the org id and
   the joining user's uid. Auth is via the user-doc rule (only the
   user can update their own organizationId) plus a sanity check
   inside the transaction that the org actually carries the user's
   email domain in its autoJoinDomains list. */
export async function joinOrganizationByDomain(
  db: Firestore,
  orgId: string,
  uid: string,
  emailDomain: string,
  actorName: string,
): Promise<OrganizationRecord> {
  const domain = emailDomain.trim().toLowerCase();
  if (!domain) throw new Error("DOMAIN_REQUIRED");

  const result = await runTransaction(db, async (transaction) => {
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await transaction.get(orgRef);
    if (!orgSnap.exists()) {
      throw new Error("ORG_NOT_FOUND");
    }
    const orgData = orgSnap.data() as Partial<OrganizationRecord>;
    const allowed = Array.isArray(orgData.autoJoinDomains) ? orgData.autoJoinDomains : [];
    if (!allowed.includes(domain)) {
      throw new Error("DOMAIN_NOT_ALLOWED");
    }
    transaction.set(
      doc(db, "users", uid),
      {
        organizationId: orgId,
        organizationName: orgData.name || "",
        organizationRole: "member",
      },
      { merge: true },
    );
    return {
      id: orgData.id || orgId,
      name: orgData.name || "",
      ownerUid: orgData.ownerUid || "",
      createdAt: orgData.createdAt || new Date().toISOString(),
    } satisfies OrganizationRecord;
  });

  await recordAuditLog(db, {
    orgId: result.id,
    type: "organization.member_joined",
    actorUid: uid,
    actorName,
    target: `${result.name}（ドメイン自動参加）`,
  });

  return result;
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
    planTier: normalizePlanTier(data.planTier),
    slackWebhookUrl: typeof data.slackWebhookUrl === "string" ? data.slackWebhookUrl : undefined,
    slackEvents: data.slackEvents
      ? {
          roomJoins: Boolean(data.slackEvents.roomJoins),
          roomLeaves: Boolean(data.slackEvents.roomLeaves),
          breakStarted: Boolean(data.slackEvents.breakStarted),
          recruitments: Boolean(data.slackEvents.recruitments),
          posts: Boolean(data.slackEvents.posts),
          dailyDigest: Boolean(data.slackEvents.dailyDigest),
        }
      : undefined,
    autoJoinDomains: Array.isArray(data.autoJoinDomains)
      ? (data.autoJoinDomains.filter((value) => typeof value === "string") as string[])
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
  /* Phase 9: optional team-grouping label set by the org owner.
     Free-form so non-engineering orgs can use whatever taxonomy makes
     sense ("Frontend" / "Backend" / "Infra", or "Sales" / "Marketing").
     Empty string when unassigned — the dashboard groups those as
     「未割り当て」. */
  teamName: string;
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
      teamName: typeof data.teamName === "string" ? data.teamName : "",
    };
  });
}

/* 目標 (志望校 / 資格) が同じユーザーを一覧する。プロフィールの
   目標 chip からの「同じ目標の人を探す」モーダルで使う。
   - goalId 指定: catalog 一致の正規目標。Firestore 単一フィールド
     equality query なので自動 index でカバー。
   - goalCustomName 指定: ユーザー自由入力。完全一致のみ拾う。
     軽い tag-search 用途で、表記揺れは別途 client 側で fuzzy 化する
     余地は残す (現状は exact match)。 */
export type GoalMatchUser = {
  uid: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  streak: number;
  goalId: string;
  goalCustomName: string;
  characterColor?: string;
  characterShape?: string;
  determination?: string;
  lastSyncedAt: string;
};

export async function listUsersByGoal(
  db: Firestore,
  goal: { goalId?: string; goalCustomName?: string },
  limitCount = 40,
): Promise<GoalMatchUser[]> {
  const goalId = (goal.goalId || "").trim();
  const goalCustomName = (goal.goalCustomName || "").trim();
  if (!goalId && !goalCustomName) return [];

  const constraint = goalId
    ? where("goalId", "==", goalId)
    : where("goalCustomName", "==", goalCustomName);
  const snapshot = await getDocs(query(collection(db, "users"), constraint));
  /* limit() を query 側でかけても良いが、blockedUids 等のフィルタを
     client 側で重ねたいケースに備え、ここでは取り敢えず全件読みで
     limitCount を超えたら切る (Firestore コストは uid 数で線形)。 */
  const users: GoalMatchUser[] = [];
  for (const doc of snapshot.docs) {
    if (users.length >= limitCount) break;
    const data = doc.data() as Record<string, unknown>;
    /* 自由入力 (custom) で query した場合、catalog 一致した別ユーザー
       (goalId 経由) を取り損ねる。逆も同様。 query 段階で取り損ねた
       ものは client では出ない ― 目標は片方しか保存されない設計
       (catalog 選択時は goalCustomName が空) なので問題なし。 */
    users.push({
      uid: doc.id,
      userId: typeof data.userId === "string" ? data.userId : "",
      displayName: typeof data.displayName === "string" ? data.displayName : "Developer",
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
      level: typeof data.level === "number" ? data.level : 1,
      streak: typeof data.streak === "number" ? data.streak : 0,
      goalId: typeof data.goalId === "string" ? data.goalId : "",
      goalCustomName: typeof data.goalCustomName === "string" ? data.goalCustomName : "",
      characterColor: typeof data.characterColor === "string" ? data.characterColor : undefined,
      characterShape: typeof data.characterShape === "string" ? data.characterShape : undefined,
      determination: typeof data.determination === "string" ? data.determination : undefined,
      lastSyncedAt: typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : "",
    });
  }
  return users;
}

/* Phase 9: org owner sets / clears a member's team label. Only the
   `teamName` field changes; the Firestore rule's diff() check
   enforces that the owner cannot piggy-back any other field edit on
   this write. Empty string clears the assignment. */
export async function setMemberTeamName(
  db: Firestore,
  orgId: string,
  targetUid: string,
  teamName: string,
  actor: { uid: string; name: string },
  target: { name: string },
): Promise<void> {
  const trimmed = teamName.trim().slice(0, 40);
  await setDoc(
    doc(db, "users", targetUid),
    { teamName: trimmed },
    { merge: true },
  );
  await recordAuditLog(db, {
    orgId,
    type: "organization.team_updated",
    actorUid: actor.uid,
    actorName: actor.name,
    target: target.name,
    payload: trimmed ? { teamName: trimmed } : { teamName: "" },
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
      planTier: normalizePlanTier(orgData.planTier),
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

/* Admin removes a member from the org (Phase 8). Only the org owner
   can call this; the rule at /users/{uid} validates that the caller
   is the owner of the target's current org and that ONLY the three
   org-membership fields change. The target's personal data
   (study logs, posts, etc.) is unaffected — removal is just the
   tenant tie, not data deletion. */
export async function removeOrganizationMember(
  db: Firestore,
  orgId: string,
  targetUid: string,
  actor: { uid: string; name: string },
  target: { name: string; previousRole?: "owner" | "admin" | "member" },
): Promise<void> {
  await setDoc(
    doc(db, "users", targetUid),
    {
      organizationId: null,
      organizationName: null,
      organizationRole: null,
    },
    { merge: true },
  );
  await recordAuditLog(db, {
    orgId,
    type: "organization.member_removed",
    actorUid: actor.uid,
    actorName: actor.name,
    target: target.name,
    payload: target.previousRole ? { previousRole: target.previousRole } : undefined,
  });
}

/* Aggregate every Firestore document owned by the calling user into
   a single JSON blob suitable for download. Used by the "個人データ
   をエクスポート" button — satisfies 個人情報保護法 / GDPR data
   subject access rights without requiring a backend. */
export type UserDataExport = {
  exportedAt: string;
  uid: string;
  user: Record<string, unknown> | null;
  posts: Record<string, unknown>[];
  studyLogs: Record<string, unknown>[];
  dailyReports: Record<string, unknown>[];
  learningItems: Record<string, unknown>[];
  workspaceSessions: Record<string, unknown>[];
  workspaceRecruitments: Record<string, unknown>[];
  achievements: Record<string, unknown>[];
  githubActivities: Record<string, unknown>[];
  friendRequests: Record<string, unknown>[];
  username: string;
};

async function fetchCollectionByUserField(
  db: Firestore,
  collectionPath: string,
  field: string,
  uid: string,
): Promise<Record<string, unknown>[]> {
  const snapshot = await getDocs(query(collection(db, collectionPath), where(field, "==", uid)));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Record<string, unknown>) }));
}

export async function exportUserData(
  db: Firestore,
  uid: string,
  userId: string,
): Promise<UserDataExport> {
  const [userSnap, posts, studyLogs, dailyReports, learningItems, sessions, recruitments, achievements, githubActivities] =
    await Promise.all([
      getDoc(doc(db, "users", uid)),
      fetchCollectionByUserField(db, "posts", "userId", uid),
      fetchCollectionByUserField(db, "studyLogs", "userId", uid),
      fetchCollectionByUserField(db, "dailyReports", "userId", uid),
      fetchCollectionByUserField(db, "learningItems", "userId", uid),
      fetchCollectionByUserField(db, "workspaceSessions", "userId", uid),
      fetchCollectionByUserField(db, "workspaceRecruitments", "userId", uid),
      fetchCollectionByUserField(db, "achievements", "userId", uid),
      fetchCollectionByUserField(db, "githubActivities", "userId", uid),
    ]);

  // Friend requests live on either side of the relationship; fetch
  // both and dedupe by id.
  const fromMe = await fetchCollectionByUserField(db, "friendRequests", "fromUid", uid);
  const toMe = await fetchCollectionByUserField(db, "friendRequests", "toUid", uid);
  const seenIds = new Set<string>();
  const friendRequests = [...fromMe, ...toMe].filter((row) => {
    const id = row.id as string;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  return {
    exportedAt: new Date().toISOString(),
    uid,
    user: userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : null,
    posts,
    studyLogs,
    dailyReports,
    learningItems,
    workspaceSessions: sessions,
    workspaceRecruitments: recruitments,
    achievements,
    githubActivities,
    friendRequests,
    username: userId,
  };
}

/* Cascade-delete every doc owned by the user, then the user doc
   itself, then the username reservation. Deletes are batched (up
   to 450 ops per batch to stay under Firestore's 500-op limit with
   headroom). Each collection's allow-delete rule already restricts
   to the owner, so a regression in client code cannot delete
   somebody else's data through this helper. */
async function deleteCollectionByUserField(
  db: Firestore,
  collectionPath: string,
  field: string,
  uid: string,
): Promise<number> {
  const snapshot = await getDocs(query(collection(db, collectionPath), where(field, "==", uid)));
  if (snapshot.empty) return 0;
  const batches: Array<ReturnType<typeof writeBatch>> = [];
  let current = writeBatch(db);
  let opsInCurrent = 0;
  for (const item of snapshot.docs) {
    current.delete(item.ref);
    opsInCurrent += 1;
    if (opsInCurrent >= 450) {
      batches.push(current);
      current = writeBatch(db);
      opsInCurrent = 0;
    }
  }
  if (opsInCurrent > 0) batches.push(current);
  for (const batch of batches) {
    await batch.commit();
  }
  return snapshot.size;
}

export type DeleteAccountResult = {
  deletedCounts: Record<string, number>;
};

export async function deleteUserAccount(
  db: Firestore,
  uid: string,
  userId: string,
): Promise<DeleteAccountResult> {
  // Order matters: collections before users. Username reservation
  // is removed last because losing the user doc first would already
  // be visible as "deleted" to anyone scanning the search index.
  const deletedCounts: Record<string, number> = {};
  deletedCounts.studyLogs = await deleteCollectionByUserField(db, "studyLogs", "userId", uid);
  deletedCounts.workspaceSessions = await deleteCollectionByUserField(
    db,
    "workspaceSessions",
    "userId",
    uid,
  );
  deletedCounts.dailyReports = await deleteCollectionByUserField(db, "dailyReports", "userId", uid);
  deletedCounts.learningItems = await deleteCollectionByUserField(db, "learningItems", "userId", uid);
  deletedCounts.workspaceRecruitments = await deleteCollectionByUserField(
    db,
    "workspaceRecruitments",
    "userId",
    uid,
  );
  deletedCounts.achievements = await deleteCollectionByUserField(db, "achievements", "userId", uid);
  deletedCounts.githubActivities = await deleteCollectionByUserField(
    db,
    "githubActivities",
    "userId",
    uid,
  );
  deletedCounts.posts = await deleteCollectionByUserField(db, "posts", "userId", uid);
  const fromCount = await deleteCollectionByUserField(db, "friendRequests", "fromUid", uid);
  const toCount = await deleteCollectionByUserField(db, "friendRequests", "toUid", uid);
  deletedCounts.friendRequests = fromCount + toCount;

  // 退会カスケードの補完 (ストア審査 / GDPR 対応):
  // - workspaceInvites: 自分が送った / 受け取った作業部屋招待
  // - encouragements: 自分が送った / 受け取った応援 (👏)
  // どちらも rules 側で from/to (sender/recipient) の削除を許可している。
  // 失敗してもアカウント削除全体は止めない (ベストエフォート)。
  try {
    const inviteFrom = await deleteCollectionByUserField(db, "workspaceInvites", "fromUid", uid);
    const inviteTo = await deleteCollectionByUserField(db, "workspaceInvites", "toUid", uid);
    deletedCounts.workspaceInvites = inviteFrom + inviteTo;
  } catch {
    deletedCounts.workspaceInvites = 0;
  }
  try {
    const encSent = await deleteCollectionByUserField(db, "encouragements", "senderUid", uid);
    const encReceived = await deleteCollectionByUserField(
      db,
      "encouragements",
      "recipientUid",
      uid,
    );
    deletedCounts.encouragements = encSent + encReceived;
  } catch {
    deletedCounts.encouragements = 0;
  }

  if (userId) {
    try {
      await deleteDoc(doc(db, "usernames", userId));
      deletedCounts.username = 1;
    } catch {
      deletedCounts.username = 0;
    }
  }

  await deleteDoc(doc(db, "users", uid));
  deletedCounts.user = 1;

  return { deletedCounts };
}
