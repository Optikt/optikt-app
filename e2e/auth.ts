import { expect, type Page } from '@playwright/test';

export const adminEmail = process.env.OPTIKT_E2E_ADMIN_EMAIL ?? 'optikt.vision@gmail.com';
export const adminPassword = process.env.OPTIKT_E2E_ADMIN_PASSWORD ?? 'Admin_123';

export const sellerEmail = process.env.OPTIKT_E2E_SELLER_EMAIL ?? 'e2e.seller@optikt.local';
export const sellerPassword = process.env.OPTIKT_E2E_SELLER_PASSWORD ?? 'Seller_123';

export async function loginAs(
	page: Page,
	credentials: { email: string; password: string }
): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Correo Electrónico').fill(credentials.email);
	await page.getByLabel('Contraseña', { exact: true }).fill(credentials.password);
	await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
	await expect(page.getByRole('heading', { name: /Centro de Operaciones/ })).toBeVisible();
}

export async function loginAsAdmin(page: Page): Promise<void> {
	await loginAs(page, { email: adminEmail, password: adminPassword });
}
