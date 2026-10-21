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

test('a skill in the address that is not there, or a % that escapes nothing: the skills, the first one opened', async ({ page }) => {
  for (const hash of ['#nothing-here', '#%E0', '#%']) {
    // From another page: a change of the hash alone would not load the page again.
    await page.goto('/');
    await page.goto(`/?repo=${encodeURIComponent(DEMO_URL)}${hash}`);
    await expect(page.locator('#skills button[role="option"]')).toHaveCount(6);
    await expect(page.locator('.doc-head h1')).toHaveText('code-review');
    await expect(page.locator('#skills button[aria-selected="true"]')).toContainText('code-review');
    await expect(page).toHaveURL(/#code-review$/);
  }
});
