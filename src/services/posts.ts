import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

export type ContributionPostRecord = {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  currentCharacter: string;
  characterColor: string;
  currentTitle: string;
  text: string;
  createdAt: string;
  roomId: string;
  roomName: string;
  githubContributionCount: number;
  studyMinutes: number;
  likesCount: number;
  likedUserIds: string[];
  syncStatus?: "synced" | "pending";
  syncError?: string;
};

export type ContributionReplyRecord = {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatar: string;
  characterColor: string;
  text: string;
  createdAt: string;
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

export function subscribePostsFromCloud(
  db: Firestore,
  onChange: (posts: ContributionPostRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(80));

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          userId: readString(data.userId),
          username: readString(data.username, "Developer"),
          avatar: readString(data.avatar),
          currentCharacter: readString(data.currentCharacter, "arc-sprite"),
          characterColor: readString(data.characterColor, "#1f6f4a"),
          currentTitle: readString(data.currentTitle, "Builder"),
          text: readString(data.text),
          createdAt: readCreatedAt(data.createdAt),
          roomId: readString(data.roomId),
          roomName: readString(data.roomName),
          githubContributionCount: readNumber(data.githubContributionCount),
          studyMinutes: readNumber(data.studyMinutes),
          likesCount: readNumber(data.likesCount),
          likedUserIds: readStringList(data.likedUserIds),
          syncStatus: "synced" as const,
        };
      });

      onChange(posts.filter((post) => post.userId && post.text.trim()));
    },
    onError,
  );
}

export async function savePostToCloud(db: Firestore, post: ContributionPostRecord) {
  const { syncStatus, syncError, ...cloudPost } = post;
  await setDoc(
    doc(db, "posts", post.id),
    {
      ...cloudPost,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribePostRepliesFromCloud(
  db: Firestore,
  onChange: (replies: ContributionReplyRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const repliesQuery = query(collectionGroup(db, "replies"), orderBy("createdAt", "desc"), limit(200));

  return onSnapshot(
    repliesQuery,
    (snapshot) => {
      const replies = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          postId: readString(data.postId),
          userId: readString(data.userId),
          username: readString(data.username, "Developer"),
          avatar: readString(data.avatar),
          characterColor: readString(data.characterColor, "#1f6f4a"),
          text: readString(data.text),
          createdAt: readCreatedAt(data.createdAt),
        };
      });

      onChange(replies.filter((reply) => reply.postId && reply.userId && reply.text.trim()));
    },
    onError,
  );
}

export async function savePostReplyToCloud(db: Firestore, reply: ContributionReplyRecord) {
  await setDoc(
    doc(db, "posts", reply.postId, "replies", reply.id),
    {
      ...reply,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function togglePostLikeInCloud(db: Firestore, postId: string, userId: string, isLiked: boolean) {
  await updateDoc(doc(db, "posts", postId), {
    likedUserIds: isLiked ? arrayRemove(userId) : arrayUnion(userId),
    likesCount: increment(isLiked ? -1 : 1),
    updatedAt: serverTimestamp(),
  });
}
