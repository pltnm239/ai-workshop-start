import { expect, scan, test } from './fixtures.ts';

test('an unreachable repository: the message is on the page, no skills', async ({ page }) => {
  await scan(page, 'https://github.com/JetBrains/missing');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error')).toContainText('Repository not found: https://github.com/JetBrains/missing');
  await expect(page.locator('#skills button')).toHaveCount(0);
  await expect(page).toHaveScreenshot('error.png');
});
