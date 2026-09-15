import { expect, type Page } from '@playwright/test';

export const adminEmail = process.env.OPTIKT_E2E_ADMIN_EMAIL ?? 'optikt.vision@gmail.com';
export const adminPassword = process.env.OPTIKT_E2E_ADMIN_PASSWORD ?? 'Admin_123';

export async function loginAsAdmin(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Correo Electrónico').fill(adminEmail);
	await page.getByLabel('Contraseña', { exact: true }).fill(adminPassword);
	await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
	await expect(page.getByRole('heading', { name: /Centro de Operaciones/ })).toBeVisible();
}
