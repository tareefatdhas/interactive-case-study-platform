import { expect, test } from '@playwright/test';
import { authHref, invitationTokenFromDestination, safeAuthDestination } from '../src/lib/auth-destination';

const invitationToken = 'a'.repeat(64);
const invitationPath = `/invite/${invitationToken}`;

test('invitation destinations accept only local routes', () => {
  expect(safeAuthDestination('?next=%2Finvite%2Fabc123')).toBe('/invite/abc123');
  expect(safeAuthDestination('?next=https%3A%2F%2Fevil.example')).toBe('');
  expect(safeAuthDestination('?next=%2F%2Fevil.example')).toBe('');
  expect(authHref('/signup', '?next=%2Finvite%2Fabc123')).toBe('/signup?next=%2Finvite%2Fabc123');
  expect(invitationTokenFromDestination(invitationPath)).toBe(invitationToken);
  expect(invitationTokenFromDestination('/dashboard')).toBe('');
});

test('an invitation keeps its place through sign in and signup', async ({ page }) => {
  await page.goto(invitationPath);
  await expect(page.getByRole('heading', { name: 'Join the teaching team.' })).toBeVisible();
  await expect(page.getByText('create your instructor account with that same email')).toBeVisible();

  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Finvite%2F${invitationToken}$`));
  await expect(page.getByRole('link', { name: 'Create one' })).toHaveAttribute(
    'href',
    `/signup?next=%2Finvite%2F${invitationToken}`,
  );

  await page.getByRole('link', { name: 'Create one' }).click();
  await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Finvite%2F${invitationToken}$`));
  await expect(page.getByRole('heading', { name: 'Create your account to join.' })).toBeVisible();
  await expect(page.getByText('We will take you straight to the shared teaching space.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    `/login?next=%2Finvite%2F${invitationToken}`,
  );
});
