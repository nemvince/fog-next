/**
 * auth.setup.ts
 *
 * Runs once before all authenticated test projects.  It logs in with the
 * configured credentials and saves the browser storage state so the real test
 * files can skip the login flow entirely.
 *
 * Credentials are pulled from the environment (FOG_E2E_USER / FOG_E2E_PASS)
 * so they are never hard-coded.  Defaults fall back to the dev-mode admin
 * account created by `fog install`.
 */

import path from "node:path";
import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = path.join(import.meta.dirname, ".auth", "user.json");

const USERNAME = process.env.FOG_E2E_USER ?? "fog";
const PASSWORD = process.env.FOG_E2E_PASS ?? "password";

setup("authenticate", async ({ page }) => {
	await page.goto("/login");

	await page.getByLabel(/username/i).fill(USERNAME);
	await page.getByLabel(/password/i).fill(PASSWORD);
	await page.getByRole("button", { name: /sign in|log in/i }).click();

	// Wait until the dashboard is visible — confirming a successful login.
	await expect(page).toHaveURL(/\/(dashboard|hosts|$)/);
	await expect(page.getByRole("navigation")).toBeVisible();

	// Persist authentication state for reuse across test projects.
	await page.context().storageState({ path: AUTH_FILE });
});
