import { expect, test as base, type Page } from '@playwright/test';

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.route('**/*', (route) => (route.request().url().startsWith(baseURL!) ? route.continue() : route.abort()));
    await use(page);
  },
});

export { expect };

export async function scan(page: Page, input: string) {
  await page.goto('/');
  await page.locator('#repo').fill(input);
  await page.locator('#repo').press('Enter');
}

export async function scanned(page: Page, input: string) {
  await scan(page, input);
  await expect(page.locator('#skills button[role="option"]').first()).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await expect(page.locator('#go')).toHaveText('Scan');
}
