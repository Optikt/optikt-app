import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { Sql } from 'postgres';
import { loginAs, loginAsAdmin, sellerEmail, sellerPassword } from './auth';
import { closeDatabase, connectDatabase, ensureAdmin, ensureSeller, uniqueRunId } from './fixtures';

async function createTicket(page: Page, title: string, description: string): Promise<void> {
	await page.getByRole('button', { name: 'Nuevo ticket' }).click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel(/Título/).fill(title);
	await dialog.getByLabel(/Descripción/).fill(description);
	await dialog.getByLabel(/Categoría/).selectOption('BUG');
	await dialog.getByRole('button', { name: 'Crear ticket' }).click();

	await expect(dialog).toBeHidden();
	await expect(page.getByRole('link', { name: title })).toBeVisible();
}

test.describe('soporte → tickets', () => {
	let sql: Sql;
	let sellerContext: BrowserContext | undefined;

	test.beforeAll(async () => {
		sql = connectDatabase();
		await ensureAdmin(sql);
		await ensureSeller(sql);
	});

	test.afterAll(async () => {
		await closeDatabase(sql);
		await sellerContext?.close();
	});

	test('admin creates, seller only sees own and management lands in history', async ({
		page,
		browser
	}) => {
		const runId = uniqueRunId();
		const adminTitle = `E2E admin ${runId}`;
		const sellerTitle = `E2E seller ${runId}`;

		await loginAsAdmin(page);
		await page.goto('/support');
		await createTicket(page, adminTitle, 'Ticket creado por el admin desde E2E');

		sellerContext = await browser.newContext();
		const sellerPage = await sellerContext.newPage();
		await loginAs(sellerPage, { email: sellerEmail, password: sellerPassword });
		await sellerPage.goto('/support');

		await expect(sellerPage.getByText('Todavía no has reportado tickets')).toBeVisible();
		await expect(sellerPage.getByText(adminTitle)).toHaveCount(0);

		await createTicket(sellerPage, sellerTitle, 'Ticket creado por el seller desde E2E');
		await expect(sellerPage.getByText(adminTitle)).toHaveCount(0);

		await page.reload();
		await expect(page.getByRole('link', { name: adminTitle })).toBeVisible();
		await expect(page.getByRole('link', { name: sellerTitle })).toBeVisible();

		await page.getByRole('link', { name: sellerTitle }).click();
		await expect(page.getByRole('heading', { name: /Ticket #\d+/ })).toBeVisible();

		await page.getByLabel('Estado').selectOption('IN_PROGRESS');
		await page.getByLabel('Prioridad').selectOption('HIGH');
		await page.getByLabel('Comentario (opcional)').fill('Revisado en E2E');
		await page.getByRole('button', { name: 'Guardar cambios' }).click();

		await expect(page.getByText('Abierto → En progreso')).toBeVisible();
		await expect(page.getByText('Media → Alta')).toBeVisible();
		await expect(page.getByText('Revisado en E2E')).toBeVisible();
	});
});
