import { expect, test } from '@playwright/test';
import type { Sql } from 'postgres';
import { loginAsAdmin } from './auth';
import {
	closeDatabase,
	connectDatabase,
	ensureAdmin,
	seedMaterial,
	seedOpenCountSession,
	seedProduct,
	seedSupplier,
	uniqueRunId
} from './fixtures';

test.describe('conteo físico → cerrar sesión', () => {
	let sql: Sql;
	let sessionId = 0;

	test.beforeAll(async () => {
		sql = connectDatabase();
		const adminId = await ensureAdmin(sql);
		const runId = uniqueRunId();

		const supplierId = await seedSupplier(sql, `Proveedor E2E ${runId}`);
		const materialId = await seedMaterial(sql, `Acetato E2E ${runId}`, `E2E-${runId}`);
		const productId = await seedProduct(sql, {
			supplierId,
			materialId,
			name: `Montura E2E ${runId}`,
			sku: `E2E-CNT-${runId}`,
			stock: 5,
			purchasePrice: 1000,
			salePrice: 1500
		});

		sessionId = await seedOpenCountSession(sql, {
			openedById: adminId,
			productId,
			systemStock: 5,
			countedStock: 5
		});
	});

	test.afterAll(async () => {
		await closeDatabase(sql);
	});

	test('closes an open count session from the UI', async ({ page }) => {
		await loginAsAdmin(page);

		await page.goto(`/inventory/count/${sessionId}`);
		await page.getByRole('button', { name: 'Cerrar sesión' }).click();
		await page.getByRole('button', { name: 'Cerrar sesión de conteo' }).click();

		await expect(page.getByText('Sesión de conteo cerrada')).toBeVisible();
		await expect(page.getByText('Informe de conteo físico')).toBeVisible();
	});
});
