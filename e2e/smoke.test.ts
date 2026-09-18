import { test } from '@playwright/test';
import { loginAsAdmin } from './auth';

test('admin logs in and reaches the dashboard', async ({ page }) => {
	await loginAsAdmin(page);
});
