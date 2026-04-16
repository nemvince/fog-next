/**
 * hosts.spec.ts — Host management flows
 *
 * Tests authenticate via the shared storage state produced by auth.setup.ts.
 * Covers: listing hosts, creating a host, viewing host detail, deleting a host.
 */
import { expect, test } from '@playwright/test';

const TEST_HOST_NAME = `e2e-host-${Date.now()}`;
const TEST_HOST_MAC  = '00:11:22:33:44:55';

test.describe('Hosts list', () => {
  test('navigates to /hosts from the sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /hosts/i }).click();

    await expect(page).toHaveURL(/\/hosts/);
    await expect(page.getByRole('heading', { name: /hosts/i })).toBeVisible();
  });

  test('displays the hosts table with at least one column header', async ({ page }) => {
    await page.goto('/hosts');

    // The table should have at least a "Name" column.
    await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
  });
});

test.describe('Create host', () => {
  let hostId: string;

  test('creates a new host via the UI form', async ({ page }) => {
    await page.goto('/hosts');

    // Open the create / add host dialog.
    await page.getByRole('button', { name: /add host|new host|create/i }).click();

    // Fill in the required name field.
    await page.getByLabel(/host name|name/i).fill(TEST_HOST_NAME);

    // Optionally fill in a MAC address if the form supports it.
    const macField = page.getByLabel(/mac address|mac/i);
    if (await macField.isVisible()) {
      await macField.fill(TEST_HOST_MAC);
    }

    await page.getByRole('button', { name: /save|create|add/i }).click();

    // The new host should appear somewhere on the page (list or detail view).
    await expect(page.getByText(TEST_HOST_NAME)).toBeVisible();

    // Try to grab the host ID from the URL if navigation happened.
    const url = page.url();
    const match = url.match(/\/hosts\/([0-9a-f-]{36})/);
    if (match) {
      hostId = match[1];
    }
  });

  test('shows host detail page with correct name', async ({ page }) => {
    // Navigate directly if we captured the ID, otherwise search in the list.
    if (hostId) {
      await page.goto(`/hosts/${hostId}`);
    } else {
      await page.goto('/hosts');
      await page.getByRole('link', { name: TEST_HOST_NAME }).click();
    }

    await expect(page.getByText(TEST_HOST_NAME)).toBeVisible();
  });

  test('deletes the created host', async ({ page }) => {
    await page.goto('/hosts');

    // Find the row containing the test host and click its delete action.
    const row = page.getByRole('row', { name: new RegExp(TEST_HOST_NAME) });
    await row.getByRole('button', { name: /delete|remove/i }).click();

    // Confirm deletion in any confirmation dialog.
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // The host must no longer appear in the list.
    await expect(page.getByRole('row', { name: new RegExp(TEST_HOST_NAME) })).toHaveCount(0);
  });
});
