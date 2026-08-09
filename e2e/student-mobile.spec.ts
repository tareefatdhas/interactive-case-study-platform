import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test('join flow fits a phone and keeps primary fields usable', async ({ page }) => {
  await page.goto('/join');

  await expect(page.getByRole('heading', { name: 'Join the class.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Student number' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('student classroom fits a phone viewport', async ({ page }) => {
  await page.goto('/live/student');

  await expect(page.locator('body')).toContainText('Classfully');
  await expect(page.locator('main')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
