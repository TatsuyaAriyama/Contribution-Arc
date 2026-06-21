// Playwright global setup: seed a deterministic email/password user into the
// Auth Emulator AND a matching Firestore profile so the e2e specs can sign in
// and land straight on the app (no first-run onboarding). Runs once before the
// suite. Assumes Auth+Firestore Emulators are up (verify.sh / test:e2e wrap the
// whole run in `firebase emulators:exec --only auth,firestore`).
import {
  E2E_USER,
  AUTH_EMULATOR_HOST,
  FIRESTORE_EMULATOR_HOST,
  FIREBASE_PROJECT_ID,
} from "./fixtures/test-user";

// Returns the seeded user's uid (localId). signUp is idempotent enough: a
// duplicate email returns EMAIL_EXISTS, in which case we look the uid up.
async function seedAuthUser(): Promise<string> {
  const base = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts`;
  const res = await fetch(`${base}:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: E2E_USER.email,
      password: E2E_USER.password,
      returnSecureToken: true,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    localId?: string;
    error?: { message?: string };
  };
  if (res.ok && body.localId) return body.localId;
  if (body.error?.message === "EMAIL_EXISTS") {
    // Already seeded in a prior run on a persisted emulator — sign in to
    // recover the uid.
    const signIn = await fetch(`${base}:signInWithPassword?key=fake-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: E2E_USER.email,
        password: E2E_USER.password,
        returnSecureToken: true,
      }),
    });
    const signInBody = (await signIn.json().catch(() => ({}))) as { localId?: string };
    if (signIn.ok && signInBody.localId) return signInBody.localId;
  }
  throw new Error(
    `Auth emulator seed failed (${res.status}): ${body.error?.message ?? "unknown"}`,
  );
}

// Write users/{uid} so the app treats onboarding as already complete (it keys
// off profile.userId + profile.onboardingCompletedAt). `Bearer owner` makes the
// emulator bypass security rules for this admin-style seed write.
async function seedProfile(uid: string) {
  const url =
    `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: "e2euser" },
        displayName: { stringValue: "E2E User" },
        language: { stringValue: "ja" },
        onboardingCompletedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore profile seed failed (${res.status}): ${text}`);
  }
}

export default async function globalSetup() {
  try {
    const uid = await seedAuthUser();
    await seedProfile(uid);
  } catch (error) {
    throw new Error(
      `e2e global-setup could not reach the emulators (Auth ${AUTH_EMULATOR_HOST}, ` +
        `Firestore ${FIRESTORE_EMULATOR_HOST}, project ${FIREBASE_PROJECT_ID}). ` +
        `Run via \`npm run test:e2e\` so the emulators are started.`,
      { cause: error },
    );
  }
}
