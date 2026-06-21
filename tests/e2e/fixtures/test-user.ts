// Shared e2e constants. Kept in one place so global-setup (seeding) and the
// specs (login) never drift apart.
export const FIREBASE_PROJECT_ID =
  process.env.VITE_FIREBASE_PROJECT_ID ?? "github-contribution-rpg";

export const AUTH_EMULATOR_HOST = "127.0.0.1:9099";
export const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

export const E2E_USER = {
  email: "e2e@example.com",
  password: "test123456",
};
