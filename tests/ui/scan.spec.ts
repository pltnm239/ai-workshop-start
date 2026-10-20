import { DEMO_URL } from './data.ts';
import { expect, scanned, test } from './fixtures.ts';

const option = (page: import('@playwright/test').Page, name: string) => page.locator('#skills button[role="option"]', { hasText: name });

test('a scan lists the project skills by name, and the first one is open', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await expect(page.locator('#skills .skill-title')).toHaveText([
    'code-review',
    'code-style',
    'commits',
    'debugging',
    'release-checklist',
    'writing-lint-checks',
  ]);
  await expect(page.locator('#repo-card')).toContainText('6 skills');
  await expect(page.locator('#repo-card')).toContainText('@ 5ab6270');
  await expect(page).toHaveScreenshot('scanned.png');
});

test('a skill is rendered as Markdown, and shown as source on the other tab', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await option(page, 'code-style').click();
  await expect(page.locator('.doc-head h1')).toHaveText('code-style');
  await expect(page.locator('#view table')).toBeVisible();
  await expect(page).toHaveScreenshot('markdown.png');
  await page.getByRole('tab', { name: 'Source' }).click();
  await expect(page.locator('#view table')).toHaveCount(0);
  await expect(page).toHaveScreenshot('source.png');
});

test('the same skill in two agents is one skill with `also in`', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await option(page, 'commits').click();
  await expect(page.locator('.doc-meta')).toContainText('also in .claude/skills/commits/SKILL.md');
  await expect(page.locator('#skills .skill-title', { hasText: /^commits$/ })).toHaveCount(1);
  await expect(page).toHaveScreenshot('copies.png');
});

test('HTML in a SKILL.md is shown as text, never run', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });
  await scanned(page, DEMO_URL);
  await option(page, 'commits').click();
  await expect(page.locator('#view .markdown')).toContainText('<script>alert(1)</script>');
  expect(dialogs).toBe(0);
});

test('malformed front matter: the skill keeps its directory name, the warning is on the page', async ({ page }) => {
  await scanned(page, DEMO_URL);
  await expect(page.locator('#warnings')).toBeVisible();
  await expect(page.locator('#warnings summary')).toHaveText('1 warning');
  await page.locator('#warnings summary').click();
  await expect(page.locator('#warnings li')).toContainText('release-checklist/SKILL.md: malformed front matter');
  await expect(page).toHaveScreenshot('warning.png');
});
