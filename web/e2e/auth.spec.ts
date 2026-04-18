/**
 * auth.spec.ts — Login / logout flow
 *
 * Verifies the authentication flow without relying on the shared auth state.
 * These tests use a fresh browser context so they exercise the full auth path.
 */
import { expect, test } from "@playwright/test";

// Override the storageState set in the project config — we want a fresh context.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login page", () => {
	test("shows the login form", async ({ page }) => {
		await page.goto("/login");

		await expect(
			page.getByRole("heading", { name: /sign in|log in|fog/i }),
		).toBeVisible();
		await expect(page.getByLabel(/username/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /sign in|log in/i }),
		).toBeVisible();
	});

	test("shows an error on bad credentials", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel(/username/i).fill("nobody");
		await page.getByLabel(/password/i).fill("wrongpass");
		await page.getByRole("button", { name: /sign in|log in/i }).click();

		// The page must NOT navigate away.
		await expect(page).toHaveURL(/\/login/);
		// An error message must appear somewhere on the page.
		await expect(
			page.getByText(/invalid|incorrect|unauthori[sz]ed|wrong/i),
		).toBeVisible();
	});

	test("redirects to dashboard after successful login", async ({ page }) => {
		const username = process.env.FOG_E2E_USER ?? "fog";
		const password = process.env.FOG_E2E_PASS ?? "password";

		await page.goto("/login");
		await page.getByLabel(/username/i).fill(username);
		await page.getByLabel(/password/i).fill(password);
		await page.getByRole("button", { name: /sign in|log in/i }).click();

		await expect(page).toHaveURL(/\/(dashboard|hosts|$)/);
		// Navigation sidebar should be present after login.
		await expect(page.getByRole("navigation")).toBeVisible();
	});
});

test.describe("Logout", () => {
	// Re-authenticate inline for this lone test so it does not depend on the
	// shared storageState which is deliberately cleared in this file.
	test.beforeEach(async ({ page }) => {
		const username = process.env.FOG_E2E_USER ?? "fog";
		const password = process.env.FOG_E2E_PASS ?? "password";

		await page.goto("/login");
		await page.getByLabel(/username/i).fill(username);
		await page.getByLabel(/password/i).fill(password);
		await page.getByRole("button", { name: /sign in|log in/i }).click();
		await expect(page).toHaveURL(/\/(dashboard|hosts|$)/);
	});

	test("logs out and redirects to login", async ({ page }) => {
		// Find the logout trigger — it may be inside a user menu dropdown.
		const logoutBtn = page.getByRole("button", { name: /log.?out|sign.?out/i });
		if (await logoutBtn.isVisible()) {
			await logoutBtn.click();
		} else {
			// Open user menu first then click logout.
			await page
				.getByRole("button", { name: /user|account|profile/i })
				.first()
				.click();
			await page.getByRole("menuitem", { name: /log.?out|sign.?out/i }).click();
		}

		await expect(page).toHaveURL(/\/login/);
	});
});
