import { DEMO_URL, SAME_NAME_URL } from './data.ts';
import { expect, scanned, test } from './fixtures.ts';

test('the address keeps the repository and the skill: a reload shows the same', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await page.locator('#skills button[role="option"]', { hasText: 'debugging' }).click();
  await expect(page).toHaveURL(/\?repo=.*#\.claude\/skills\/debugging\/SKILL\.md$/);
  await page.reload();
  await expect(page.locator('#repo')).toHaveValue(DEMO_URL);
  await expect(page.locator('.doc-head h1')).toHaveText('debugging');
  await expect(page.locator('#skills button[aria-selected="true"]')).toContainText('debugging');
});

test('two skills with the same name: each its own address; reload and Back show the one selected', async ({ page }) => {
  await scanned(page, SAME_NAME_URL);
  const options = page.locator('#skills button[role="option"]');
  await expect(options).toHaveCount(2);
  await options.nth(1).click();
  await expect(page.locator('.markdown')).toHaveText('Beta body');
  await expect(page).toHaveURL(/#\.agents\/skills\/beta\/SKILL\.md$/);
  await page.reload();
  await expect(page.locator('.markdown')).toHaveText('Beta body');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await options.nth(0).click();
  await expect(page.locator('.markdown')).toHaveText('Alpha body');
  await page.goBack();
  await expect(page.locator('.markdown')).toHaveText('Beta body');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('the address keeps the repository scanned, not the text typed in the field since', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await page.locator('#repo').fill('github.com/JetBrains/koog');
  await page.locator('#skills button[role="option"]', { hasText: 'commits' }).click();
  await expect(page).toHaveURL(`/?repo=${encodeURIComponent(DEMO_URL)}#.agents/skills/commits/SKILL.md`);
  await page.reload();
  await expect(page.locator('#repo')).toHaveValue(DEMO_URL);
  await expect(page.locator('.doc-head h1')).toHaveText('commits');
  await expect(page.locator('#error')).toBeHidden();
});
