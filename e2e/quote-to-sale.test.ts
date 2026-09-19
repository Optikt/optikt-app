import { expect, test } from '@playwright/test';
import type { Sql } from 'postgres';
import { loginAsAdmin } from './auth';
import {
	closeDatabase,
	connectDatabase,
	ensureAdmin,
	seedCreditPurchaseOrder,
	seedCustomer,
	seedInventoryLot,
	seedMaterial,
	seedProduct,
	seedSupplier,
	uniqueRunId
} from './fixtures';

test.describe('presupuesto → venta', () => {
	let sql: Sql;
	let documentNumber = '';
	let productName = '';

	test.beforeAll(async () => {
		sql = connectDatabase();
		const adminId = await ensureAdmin(sql);
		const runId = uniqueRunId();
		documentNumber = runId;
		productName = `Montura E2E ${runId}`;

		const supplierId = await seedSupplier(sql, `Proveedor E2E ${runId}`);
		const materialId = await seedMaterial(sql, `Acetato E2E ${runId}`, `E2E-${runId}`);
		const productId = await seedProduct(sql, {
			supplierId,
			materialId,
			name: productName,
			sku: `E2E-QTE-${runId}`,
			stock: 0,
			purchasePrice: 1000,
			salePrice: 1500
		});
		const { itemId } = await seedCreditPurchaseOrder(sql, {
			createdById: adminId,
			supplierId,
			productId,
			label: runId
		});
		await seedInventoryLot(sql, {
			purchaseOrderItemId: itemId,
			productId,
			quantity: 3,
			purchasePrice: 1000,
			salePrice: 1500
		});
		await seedCustomer(sql, {
			firstName: 'Cliente',
			lastName: `E2E ${runId}`,
			idNumber: `V-${documentNumber}`
		});
	});

	test.afterAll(async () => {
		await closeDatabase(sql);
	});

	test('creates a quote from the wizard and converts it into a sale', async ({ page }) => {
		await loginAsAdmin(page);

		await page.goto('/quotes/new');

		await page.getByPlaceholder('12345678').fill(documentNumber);
		await expect(page.getByText('Seleccionado')).toBeVisible();
		await page.getByRole('button', { name: 'Continuar' }).click();

		await page.getByPlaceholder('Buscar items...').fill(productName);
		await page
			.getByRole('button', { name: new RegExp(productName) })
			.first()
			.click();
		await page.getByRole('button', { name: 'Continuar' }).click();
		await page.getByRole('button', { name: 'Continuar' }).last().click();

		await page.getByRole('button', { name: 'Crear Presupuesto' }).click();
		await expect(page.getByText('Presupuesto creado exitosamente')).toBeVisible();
		await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);

		await page.getByRole('button', { name: /Convertir a venta/ }).click();
		await page.getByRole('button', { name: 'Convertir a Venta' }).last().click();

		await expect(page.getByText('Presupuesto convertido a venta exitosamente')).toBeVisible();
		await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
	});
});
