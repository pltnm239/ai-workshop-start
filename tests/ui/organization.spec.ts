import { expect, scan, test } from './fixtures.ts';

test('an organization: the repositories with skills, the first three, then `+N more`', async ({ page }) => {
  await scan(page, 'https://github.com/JetBrains');
  await expect(page.locator('.owner h2')).toContainText('with skills, among them');
  await expect(page.locator('.owner li')).toHaveCount(3);
  await expect(page.locator('.owner .more')).toBeVisible();
  await expect(page).toHaveScreenshot('organization.png');
  await page.locator('.owner .more').click();
  await expect(page.locator('.owner li')).not.toHaveCount(3);
  await expect(page.locator('.owner .more')).toHaveCount(0);
  await expect(page).toHaveScreenshot('organization-all.png');
});
