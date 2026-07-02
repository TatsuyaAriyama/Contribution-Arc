// Reusable login flow for the e2e specs. Drives the real email/password form
// (LoginScreen) against the Auth Emulator. The whole app sits behind the
// auth gate (App.tsx: `if (!currentUser) return <LoginScreen/>`), so every
// spec starts here.
import { expect, type Page } from "@playwright/test";
import { E2E_USER } from "./test-user";

export async function login(page: Page) {
  await page.goto("/");

  // The email form is collapsed behind a toggle to keep the brand visual
  // front-and-center; open it before filling.
  await page.getByTestId("login-email-toggle").click();
  await page.getByTestId("login-email").fill(E2E_USER.email);
  await page.getByTestId("login-password").fill(E2E_USER.password);
  await page.getByTestId("login-submit").click();

  // After auth resolves, the app renders. The default view is the home
  // (feed) screen. Since the home reorg (posts moved to their own view),
  // the composer no longer lives here — the bottom nav's home tab is the
  // most stable "we're in" signal instead.
  await expect(page.getByTestId("bottomnav-home")).toBeVisible({
    timeout: 20_000,
  });
}
