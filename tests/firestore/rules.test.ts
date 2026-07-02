// Firestore セキュリティルールのテスト（emulator + @firebase/rules-unit-testing）。
// ゴール③ データ管理: 所有者モデルと default deny を実ルールに対して検証する。
//
// 対応チェック ID:
//   RULES-RECORD-OWNER … 学習記録(learningItems/studyLogs)・posts の所有者制約
//   RULES-DENY-DEFAULT … 未定義パスは拒否
//
// 実行は emulator 前提（verify.sh が firebase emulators:exec でラップ）:
//   firebase emulators:exec --only firestore \
//     "vitest run --config tests/firestore/vitest.config.ts"
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const ALICE = "alice";
const BOB = "bob";

// rules を満たす最小ペイロード
const learningItem = (userId: string) => ({
  userId,
  name: "リーダブルコード",
  category: "book",
  color: "#888888",
});
const studyLog = (userId: string, minutes = 30) => ({
  userId,
  category: "coding",
  studyMinutes: minutes,
  earnedExp: minutes,
});
const post = (userId: string) => ({
  userId,
  text: "今日も30分コミット",
  username: "alice",
  createdAt: new Date().toISOString(),
  likesCount: 0,
  likedUserIds: [],
});
const focusPresence = (userId: string) => ({
  userId,
  name: "Alice",
  subject: "リーダブルコード",
  mode: "stopwatch",
  startedAt: Date.now(),
  lastSeenAt: new Date().toISOString(),
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-contribution-arc",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// セキュリティルールを無視して下準備（既存ドキュメントの seed 用）
async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const aliceDb = () => testEnv.authenticatedContext(ALICE).firestore();
const bobDb = () => testEnv.authenticatedContext(BOB).firestore();
const anonDb = () => testEnv.unauthenticatedContext().firestore();

describe("learningItems (RULES-RECORD-OWNER)", () => {
  it("所有者は自分の学習記録を作成・読取できる", async () => {
    const db = aliceDb();
    await assertSucceeds(setDoc(doc(db, "learningItems/i1"), learningItem(ALICE)));
    await assertSucceeds(getDoc(doc(db, "learningItems/i1")));
  });

  it("他人の userId では作成できない", async () => {
    // bob が userId=alice の記録を作ろうとする
    await assertFails(setDoc(doc(bobDb(), "learningItems/i2"), learningItem(ALICE)));
  });

  it("他人の記録は更新・削除できない", async () => {
    await seed("learningItems/i3", learningItem(ALICE));
    await assertFails(updateDoc(doc(bobDb(), "learningItems/i3"), { name: "改ざん" }));
    await assertFails(deleteDoc(doc(bobDb(), "learningItems/i3")));
  });

  it("学習記録の read は authed なら可（ルール仕様: read は signedIn）", async () => {
    await seed("learningItems/i4", learningItem(ALICE));
    await assertSucceeds(getDoc(doc(bobDb(), "learningItems/i4")));
  });

  it("未認証は読取も書込も不可", async () => {
    await seed("learningItems/i5", learningItem(ALICE));
    await assertFails(getDoc(doc(anonDb(), "learningItems/i5")));
    await assertFails(setDoc(doc(anonDb(), "learningItems/i6"), learningItem(ALICE)));
  });
});

describe("studyLogs (RULES-RECORD-OWNER: read も所有者のみ)", () => {
  it("所有者は作成・読取できる", async () => {
    const db = aliceDb();
    await assertSucceeds(setDoc(doc(db, "studyLogs/l1"), studyLog(ALICE)));
    await assertSucceeds(getDoc(doc(db, "studyLogs/l1")));
  });

  it("他人の studyLog は読取できない（org 未所属）", async () => {
    await seed("studyLogs/l2", studyLog(ALICE));
    await assertFails(getDoc(doc(bobDb(), "studyLogs/l2")));
  });

  it("studyMinutes の上限(1440)超過は作成不可", async () => {
    await assertFails(setDoc(doc(aliceDb(), "studyLogs/l3"), studyLog(ALICE, 5000)));
  });
});

describe("posts (RULES-RECORD-OWNER: feed は authed read)", () => {
  it("作成者は投稿でき、authed は誰でも読める", async () => {
    await assertSucceeds(setDoc(doc(aliceDb(), "posts/p1"), post(ALICE)));
    await assertSucceeds(getDoc(doc(bobDb(), "posts/p1")));
  });

  it("他人になりすました投稿はできない", async () => {
    await assertFails(setDoc(doc(bobDb(), "posts/p2"), post(ALICE)));
  });

  it("他人の投稿は削除できない", async () => {
    await seed("posts/p3", post(ALICE));
    await assertFails(deleteDoc(doc(bobDb(), "posts/p3")));
  });
});

describe("focusPresence (集中の気配)", () => {
  it("本人は自分の気配を作成・更新できる", async () => {
    const db = aliceDb();
    await assertSucceeds(setDoc(doc(db, "focusPresence/alice"), focusPresence(ALICE)));
    await assertSucceeds(
      setDoc(doc(db, "focusPresence/alice"), { lastSeenAt: new Date().toISOString() }, { merge: true }),
    );
  });

  it("他人になりすました気配は作成できない", async () => {
    await assertFails(setDoc(doc(bobDb(), "focusPresence/alice"), focusPresence(ALICE)));
  });

  it("他人の気配は更新・削除できない", async () => {
    await seed("focusPresence/alice", focusPresence(ALICE));
    await assertFails(
      setDoc(doc(bobDb(), "focusPresence/alice"), { lastSeenAt: new Date().toISOString() }, { merge: true }),
    );
    await assertFails(deleteDoc(doc(bobDb(), "focusPresence/alice")));
  });

  it("authed なら誰でも読める", async () => {
    await seed("focusPresence/alice", focusPresence(ALICE));
    await assertSucceeds(getDoc(doc(bobDb(), "focusPresence/alice")));
  });

  it("未認証は読取も書込も不可", async () => {
    await seed("focusPresence/alice", focusPresence(ALICE));
    await assertFails(getDoc(doc(anonDb(), "focusPresence/alice")));
    await assertFails(setDoc(doc(anonDb(), "focusPresence/bob"), focusPresence(BOB)));
  });
});

describe("default deny (RULES-DENY-DEFAULT)", () => {
  it("ルール未定義パスは認証済みでも拒否される", async () => {
    const db = aliceDb();
    await assertFails(getDoc(doc(db, "totally/undefined")));
    await assertFails(setDoc(doc(db, "totally/undefined"), { x: 1 }));
  });
});
