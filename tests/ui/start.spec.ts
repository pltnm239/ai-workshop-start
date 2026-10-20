import { expect, test } from './fixtures.ts';

test('the start page: the field, the examples, no skills', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.placeholder h2')).toHaveText('Every agent skill in a repository');
  await expect(page.locator('#skills button')).toHaveCount(0);
  await expect(page).toHaveScreenshot('start.png');
});
