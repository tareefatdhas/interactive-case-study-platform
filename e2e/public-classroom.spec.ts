import { expect, test } from '@playwright/test';

test('instructor can reach account recovery from sign in', async ({ page }) => {
  await page.route('**/api/auth/password-reset', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  const googleButton = page.getByRole('button', { name: 'Continue with Google' });
  await expect(googleButton).toBeVisible();
  await expect(page.getByText('Or continue with email')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  const googleBox = await googleButton.boundingBox();
  const emailBox = await page.getByLabel('Email').boundingBox();
  expect(googleBox?.y).toBeLessThan(emailBox?.y ?? 0);

  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();

  await page.getByLabel('Instructor email').fill('instructor@example.edu');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  await expect(page.getByText('instructor@example.edu')).toBeVisible();
});

test('instructor signup offers Google before the email form', async ({ page }) => {
  await page.goto('/signup');

  await expect(page.getByRole('heading', { name: 'Create your instructor account.' })).toBeVisible();
  const googleButton = page.getByRole('button', { name: 'Continue with Google' });
  await expect(googleButton).toBeVisible();
  await expect(page.getByText('Or continue with email')).toBeVisible();

  const googleBox = await googleButton.boundingBox();
  const nameBox = await page.getByLabel('Name').boundingBox();
  expect(googleBox?.y).toBeLessThan(nameBox?.y ?? 0);
});

test('student join collects attendance identity without requiring a display name', async ({ page }) => {
  await page.goto('/join');

  await expect(page.getByRole('heading', { name: 'Join the class.' })).toBeVisible();
  await expect(page.getByLabel(/class code/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Student number' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Preferred name (optional)' })).toBeVisible();
});

test('the live console and projector surfaces render', async ({ browser }) => {
  const context = await browser.newContext();
  const consolePage = await context.newPage();
  const displayPage = await context.newPage();

  await consolePage.goto('/live');
  await displayPage.goto('/live/display');

  await expect(consolePage.locator('body')).toContainText('Classfully');
  await expect(displayPage.locator('body')).toContainText('Classfully');
  await expect(consolePage.locator('main')).toBeVisible();
  await expect(displayPage.locator('main')).toBeVisible();

  await context.close();
});

test('a quick timer reaches the instructor, projector, and student views', async ({ browser }) => {
  const context = await browser.newContext();
  const remotePage = await context.newPage();
  const displayPage = await context.newPage();
  const studentPage = await context.newPage();

  await remotePage.goto('/live/remote');
  await remotePage.getByRole('button', { name: /Quick tools/ }).click();
  await remotePage.getByRole('button', { name: '2 min' }).click();

  await expect(remotePage.getByText('Class timer')).toBeVisible();

  await displayPage.goto('/live/display');
  await studentPage.goto('/live/student');

  await expect(displayPage.getByRole('complementary', { name: /Class timer/ })).toBeVisible();
  await expect(studentPage.getByRole('timer', { name: /Class timer/ })).toBeVisible();
  await expect(studentPage.getByText('Visible on the classroom screen.')).toBeVisible();

  await context.close();
});

test('AI classroom endpoints reject unauthenticated requests', async ({ request }) => {
  for (const path of [
    '/api/generate-session-interactions',
    '/api/summarize-responses',
    '/api/chat',
    '/api/generate-case-study',
  ]) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), `${path} should require instructor authentication`).toBe(401);
  }
});
