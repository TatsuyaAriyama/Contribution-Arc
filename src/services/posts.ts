import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
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

export type ContributionPostType = "manual" | "auto-study" | "auto-workspace";

export type ContributionPostRecord = {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  currentCharacter: string;
  characterColor: string;
  // Snapshot of the author's equipped silhouette at post time. Used as
  // the fallback when the author's live profile can't be resolved.
  characterShape: string;
  currentTitle: string;
  text: string;
  createdAt: string;
  roomId: string;
  roomName: string;
  githubContributionCount: number;
  studyMinutes: number;
  likesCount: number;
  likedUserIds: string[];
  // どの経路で投稿されたか。auto-* は「学習記録 / 作業部屋退室から自動で流れた
  // 積み上げ通知」で、UI 側でバッジを出して通常の手書き投稿と見分けられるよう
  // にする。未設定 (legacy) は manual 扱い。
  postType?: ContributionPostType;
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
  characterShape: string;
  text: string;
  createdAt: string;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readPostType(value: unknown): ContributionPostType | undefined {
  if (value === "manual" || value === "auto-study" || value === "auto-workspace") {
    return value;
  }
  return undefined;
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
  const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));

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
          characterShape: readString(data.characterShape, "default"),
          currentTitle: readString(data.currentTitle, "Builder"),
          text: readString(data.text),
          createdAt: readCreatedAt(data.createdAt),
          roomId: readString(data.roomId),
          roomName: readString(data.roomName),
          githubContributionCount: readNumber(data.githubContributionCount),
          studyMinutes: readNumber(data.studyMinutes),
          likesCount: readNumber(data.likesCount),
          likedUserIds: readStringList(data.likedUserIds),
          postType: readPostType(data.postType),
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

export async function fetchPostRepliesOnce(
  db: Firestore,
  onError: (error: unknown) => void,
): Promise<ContributionReplyRecord[]> {
  // Legacy collection-group entry point. Kept exported because
  // the symbol may still be imported elsewhere, but it intentionally
  // does NOT fan out to subcollections any more — that path needed
  // a per-collection-group index that was never deployed, so it
  // failed silently and dropped every reply on reload. Use
  // `fetchRepliesForPosts(db, postIds)` instead; this stub returns
  // an empty array so existing callers do not crash.
  void db;
  void onError;
  return [];
}

/* Per-post reply fetch (Phase 10 bugfix).

   Previously the app pulled replies via a single
   `collectionGroup("replies")` query with `orderBy("createdAt")`.
   That kind of query requires a dedicated collection-group index
   to be enabled in Firestore; without it, every fetch threw and
   we swallowed the error, returning []. The visible symptom was
   exactly what the user reported: write a reply, see it locally,
   reload the page → every reply disappears.

   The fix is to drop the collection-group query and instead pull
   each visible post's replies subcollection in parallel. A single-
   field orderBy on a *named* subcollection works with no extra
   index. Cost: N small queries (N == visible posts, capped at 40
   by subscribePostsFromCloud) per fetch; in practice that's
   indistinguishable from one round-trip thanks to Firestore's
   request pipelining. */
export async function fetchRepliesForPosts(
  db: Firestore,
  postIds: string[],
  onError: (error: unknown) => void,
): Promise<ContributionReplyRecord[]> {
  if (postIds.length === 0) return [];
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)));
  const groups = await Promise.all(
    uniquePostIds.map(async (postId) => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "posts", postId, "replies"),
            orderBy("createdAt", "desc"),
            limit(40),
          ),
        );
        return snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            // Fall back to the path's postId when the stored field
            // is missing on legacy docs.
            postId: readString(data.postId, postId),
            userId: readString(data.userId),
            username: readString(data.username, "Developer"),
            avatar: readString(data.avatar),
            characterColor: readString(data.characterColor, "#1f6f4a"),
            characterShape: readString(data.characterShape, "default"),
            text: readString(data.text),
            createdAt: readCreatedAt(data.createdAt),
          } satisfies ContributionReplyRecord;
        });
      } catch (error) {
        // Per-post failures shouldn't tank the whole fetch — most
        // commonly this is a rules error on a single post.
        onError(error);
        return [] as ContributionReplyRecord[];
      }
    }),
  );
  return groups
    .flat()
    .filter((reply) => reply.postId && reply.userId && reply.text.trim());
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
