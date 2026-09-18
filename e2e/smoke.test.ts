import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './auth';

test('admin logs in and reaches the dashboard', async ({ page }) => {
	await loginAsAdmin(page);
});

test('unauthenticated users are redirected to login', async ({ page }) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login/);
});
