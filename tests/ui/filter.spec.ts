import { DEMO_URL } from './data.ts';
import { expect, scanned, test } from './fixtures.ts';

test('the filter narrows the list to the matches, and Escape brings the skills back', async ({ page }) => {
  await scanned(page, DEMO_URL);
  const shown = page.locator('#skills li.item:not(.out) button[role="option"]');
  await expect(shown).toHaveCount(6);
  await page.locator('#filter').fill('lint');
  await expect(shown).toHaveCount(1);
  await expect(shown).toContainText('writing-lint-checks');
  await expect(page).toHaveScreenshot('filtered.png');
  await page.locator('#filter').press('Escape');
  await expect(page.locator('#filter')).toHaveValue('');
  await expect(shown).toHaveCount(6);
});

test('a filter with no match says so', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await page.locator('#filter').fill('nothing-like-this');
  await expect(page.locator('#no-match')).toBeVisible();
  await expect(page).toHaveScreenshot('no-match.png');
});
