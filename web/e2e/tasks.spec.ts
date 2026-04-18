/**
 * tasks.spec.ts — Imaging task flows
 *
 * Tests authenticate via the shared storage state produced by auth.setup.ts.
 * Covers: listing tasks, verifying the task queue, creating a deploy task,
 * and cancelling it.
 *
 * Note: these tests rely on there being at least one host and one image in the
 * system.  In CI, seed the database with `fog migrate up` + a fixture SQL file
 * or use the API to create the required records in beforeAll.
 */
import { expect, type Page, test } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a deploy task through the REST API and returns the task ID.
 * Using the API is faster and more reliable than driving the UI for setup.
 */
async function apiCreateTask(
	page: Page,
	hostId: string,
	imageId: string,
): Promise<string> {
	const resp = await page.request.post("/api/v1/tasks", {
		data: { hostId, imageId, type: "deploy" },
	});
	expect(resp.status()).toBe(201);
	const body = await resp.json();
	return body.id as string;
}

/**
 * Returns the first host ID available via the API, or null if there are none.
 */
async function firstHostId(page: Page): Promise<string | null> {
	const resp = await page.request.get("/api/v1/hosts?limit=1");
	if (!resp.ok()) return null;
	const body = await resp.json();
	return body.items?.[0]?.id ?? body[0]?.id ?? null;
}

/**
 * Returns the first image ID available via the API, or null if there are none.
 */
async function firstImageId(page: Page): Promise<string | null> {
	const resp = await page.request.get("/api/v1/images?limit=1");
	if (!resp.ok()) return null;
	const body = await resp.json();
	return body.items?.[0]?.id ?? body[0]?.id ?? null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Tasks list", () => {
	test("navigates to /tasks from the sidebar", async ({ page }) => {
		await page.goto("/");

		await page.getByRole("link", { name: /tasks/i }).click();

		await expect(page).toHaveURL(/\/tasks/);
		await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible();
	});

	test("displays the tasks table with expected columns", async ({ page }) => {
		await page.goto("/tasks");

		await expect(
			page.getByRole("columnheader", { name: /host/i }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: /type|task/i }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: /state|status/i }),
		).toBeVisible();
	});
});

test.describe("Create and cancel task", () => {
	test("creates a deploy task and then cancels it", async ({ page }) => {
		// Resolve a real host and image via the API (fastest path).
		const hostId = await firstHostId(page);
		const imageId = await firstImageId(page);

		if (!hostId || !imageId) {
			test.skip(
				!hostId || !imageId,
				"No hosts or images available — seed the database first.",
			);
			return;
		}

		const taskId = await apiCreateTask(page, hostId, imageId);

		// Navigate to the tasks page and confirm the task is listed.
		await page.goto("/tasks");
		await expect(
			page
				.getByTestId(`task-row-${taskId}`)
				.or(page.getByRole("row").filter({ hasText: taskId.slice(0, 8) })),
		).toBeVisible();

		// Cancel the task.
		const taskRow = page
			.getByRole("row")
			.filter({ hasText: taskId.slice(0, 8) })
			.first();
		await taskRow.getByRole("button", { name: /cancel/i }).click();

		// Confirm cancellation if a dialog appears.
		const confirmBtn = page.getByRole("button", {
			name: /confirm|yes|cancel task/i,
		});
		if (await confirmBtn.isVisible()) {
			await confirmBtn.click();
		}

		// The task state badge must update to "canceled".
		await expect(
			page
				.getByRole("row")
				.filter({ hasText: taskId.slice(0, 8) })
				.getByText(/cancel/i),
		).toBeVisible();
	});
});

test.describe("Task creation via UI", () => {
	test("opens the create-task dialog from the tasks page", async ({ page }) => {
		await page.goto("/tasks");

		const newTaskBtn = page.getByRole("button", {
			name: /new task|create task|add task/i,
		});
		await expect(newTaskBtn).toBeVisible();
		await newTaskBtn.click();

		// A dialog or form should appear.
		await expect(
			page.getByRole("dialog").or(page.getByRole("form")).first(),
		).toBeVisible();
	});
});
