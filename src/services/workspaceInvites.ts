import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { guardedOnSnapshot } from "./firebaseGuard";

export type WorkspaceInviteStatus = "pending" | "accepted" | "declined";

export type WorkspaceInviteRecord = {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  roomId: string;
  roomName: string;
  message: string;
  status: WorkspaceInviteStatus;
  createdAt: string;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStatus(value: unknown): WorkspaceInviteStatus {
  return value === "accepted" || value === "declined" ? value : "pending";
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

// Targeted, recipient-scoped delivery — mirrors the friendRequests model:
// the recipient subscribes by their own uid so a sender can reach exactly
// one person. The double equality filter (toUid + status) is served by
// single-field indexes (no composite needed), and limit(20) caps reads so
// a runaway sender can't blow up the recipient's snapshot.
export function subscribeIncomingWorkspaceInvites(
  db: Firestore,
  uid: string,
  onChange: (invites: WorkspaceInviteRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const invitesQuery = query(
    collection(db, "workspaceInvites"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
    limit(20),
  );

  return guardedOnSnapshot<QuerySnapshot>(
    "workspaceInvites",
    (next, err) => onSnapshot(invitesQuery, next, err),
    (snapshot) => {
      const invites = snapshot.docs
        .map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            fromUid: readString(data.fromUid),
            fromName: readString(data.fromName, "Developer"),
            toUid: readString(data.toUid),
            roomId: readString(data.roomId),
            roomName: readString(data.roomName, "作業部屋"),
            message: readString(data.message),
            status: readStatus(data.status),
            createdAt: readCreatedAt(data.createdAt),
          } satisfies WorkspaceInviteRecord;
        })
        .filter((entry) => entry.fromUid && entry.roomId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      onChange(invites);
    },
    (error) => onError(error),
  );
}

export async function createWorkspaceInvite(db: Firestore, invite: WorkspaceInviteRecord) {
  await setDoc(doc(db, "workspaceInvites", invite.id), {
    fromUid: invite.fromUid,
    fromName: invite.fromName,
    toUid: invite.toUid,
    roomId: invite.roomId,
    roomName: invite.roomName,
    message: invite.message,
    status: invite.status,
    createdAt: invite.createdAt,
    updatedAt: serverTimestamp(),
  });
}

export async function respondToWorkspaceInvite(
  db: Firestore,
  inviteId: string,
  status: Exclude<WorkspaceInviteStatus, "pending">,
) {
  await updateDoc(doc(db, "workspaceInvites", inviteId), {
    status,
    respondedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}
