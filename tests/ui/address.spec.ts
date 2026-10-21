import { DEMO_URL } from './data.ts';
import { expect, scanned, test } from './fixtures.ts';

test('the address keeps the repository and the skill: a reload shows the same', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await page.locator('#skills button[role="option"]', { hasText: 'debugging' }).click();
  await expect(page).toHaveURL(/\?repo=.*#debugging$/);
  await page.reload();
  await expect(page.locator('#repo')).toHaveValue(DEMO_URL);
  await expect(page.locator('.doc-head h1')).toHaveText('debugging');
  await expect(page.locator('#skills button[aria-selected="true"]')).toContainText('debugging');
});

test('Back while a scan is running: the scan is dropped, the start page and its address stay on reload', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/scan?*', async (route) => { await held; await route.continue(); });
  await page.goto('/');
  await page.locator('#repo').fill(DEMO_URL);
  await page.locator('#repo').press('Enter');
  await expect(page.locator('#go')).toHaveText('Scanning');
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  const scanned = page.waitForResponse('**/api/scan?*');
  release();
  await scanned;
  await expect(page.locator('#go')).toHaveText('Scan');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#repo')).toHaveValue('');
  await expect(page.locator('#skills button[role="option"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#repo')).toHaveValue('');
  await expect(page.locator('#skills button[role="option"]')).toHaveCount(0);
});
