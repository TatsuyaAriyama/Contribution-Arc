// Firestore セキュリティルールのテスト（スケルトン）
// ゴール③ データ管理: 学習記録は所有者のみ / 未定義パスはデフォルト拒否。
// 未導入: vitest, @firebase/rules-unit-testing。Firestore エミュレータ前提。
//
// 対応チェック ID:
//   RULES-RECORD-OWNER … 所有者のみ read/write 可
//   RULES-DENY-DEFAULT … 未定義パスは拒否
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-contribution-arc",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      // host/port はエミュレータの既定（localhost:8080）を使用
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("learning records (RULES-RECORD-OWNER)", () => {
  it.todo("所有者は自分の学習記録を read/write できる", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    // TODO: firestore.rules の実際のコレクションパスに合わせる
    const ref = doc(alice, "users/alice/learningItems/item1");
    await assertSucceeds(setDoc(ref, { name: "book", ownerId: "alice" }));
    await assertSucceeds(getDoc(ref));
  });

  it.todo("他人の学習記録は read/write 拒否される", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    const ref = doc(bob, "users/alice/learningItems/item1");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { name: "hijack" }));
  });
});

describe("default deny (RULES-DENY-DEFAULT)", () => {
  it.todo("ルール未定義パスは拒否される", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const ref = doc(alice, "totally/undefined/path/x");
    await assertFails(getDoc(ref));
  });
});
