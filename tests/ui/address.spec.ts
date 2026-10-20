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
