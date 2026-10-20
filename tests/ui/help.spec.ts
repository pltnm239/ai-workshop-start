import { DEMO_URL } from './data.ts';
import { expect, scanned, test } from './fixtures.ts';

test('the help: the button at the bottom right opens it, on one screen; Escape closes it', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Help' });
  const box = (await button.boundingBox())!;
  expect(1280 - (box.x + box.width)).toBe(20);
  expect(720 - (box.y + box.height)).toBe(20);
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'How to use Skill Atlas' });
  await expect(dialog).toBeVisible();
  // Short: it all fits, nothing to scroll.
  expect(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  await expect(page).toHaveScreenshot('help.png');
  await page.keyboard.press('/');
  await expect(page.locator('#repo')).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('the help over a scan: ✕ and a click beside it close it', async ({ page }) => {
  await scanned(page, DEMO_URL);
  const button = page.getByRole('button', { name: 'Help' });
  const dialog = page.getByRole('dialog', { name: 'How to use Skill Atlas' });
  await button.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await button.click();
  await dialog.getByRole('heading', { name: 'Keys' }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(20, 700);
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});
