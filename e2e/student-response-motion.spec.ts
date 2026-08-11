import { expect, test } from '@playwright/test';

test.describe('student response transfer preview', () => {
  test('moves from sending to confirmed arrival', async ({ page }) => {
    await page.goto('/live/student/effects');

    const sendButton = page.getByRole('button', { name: 'Send answer B' });
    await sendButton.click();
    await expect(page.getByRole('status', { name: 'Sending to the class' })).toBeVisible();
    await expect(sendButton).toHaveCSS('opacity', '0');
    await expect(page.locator('.student-response-imprint')).toBeVisible();
    await expect(page.locator('.student-transfer-edge')).toHaveCSS('opacity', '0');
    await expect(page.locator('.student-transport-status')).toHaveCSS('opacity', '0');
    await expect(page.getByRole('status', { name: 'Reaching the room' })).toBeVisible({ timeout: 2_500 });
    await expect(page.locator('.student-response-imprint')).toBeHidden();
    await expect(page.locator('.student-flight-path')).toBeVisible();
    await expect.poll(() => page.locator('.student-transport-orb').evaluate((element) => getComputedStyle(element).offsetPath)).toContain('path(');
    await expect(page.getByRole('status', { name: 'Response joined the room' })).toBeVisible({ timeout: 2_500 });
    await expect.poll(() => page.locator('.student-effect-preview-body').evaluate((element) => element.style.filter)).toContain('student-screen-ripple');
    await expect(page.locator('.student-transport-status')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('status', { name: 'Response joined the room' })).toBeHidden({ timeout: 3_000 });
    await expect(sendButton).toHaveCSS('opacity', '1');
  });

  test('keeps clear feedback when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/live/student/effects');

    await page.getByRole('button', { name: 'Send answer B' }).click();
    await expect(page.getByRole('status', { name: 'Sending to the class' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Response joined the room' })).toBeVisible({ timeout: 2_500 });
    await expect(page.locator('.student-flight-path')).toBeHidden();
    await expect(page.locator('.student-effect-preview-body')).not.toHaveAttribute('style', /filter/);
  });
});
