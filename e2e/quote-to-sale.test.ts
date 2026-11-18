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
			lastName: 'E2E',
			idNumber: `V-${documentNumber}`
		});
	});

	test.afterAll(async () => {
		await closeDatabase(sql);
	});

	/** Wizard completo: step 1 (cliente opcional) → step 2 (ítem) → step 3 (crear). */
	async function createQuote(page: import('@playwright/test').Page, withCustomer: boolean) {
		await page.goto('/quotes/new');

		if (withCustomer) {
			await page.getByPlaceholder('12345678').fill(documentNumber);
			await expect(page.getByText('Seleccionado')).toBeVisible();
		}
		await page.getByRole('button', { name: 'Continuar' }).click();

		await page.getByPlaceholder('Buscar items...').fill(productName);
		await page
			.getByRole('button', { name: new RegExp(productName) })
			.first()
			.click();
		await page.getByRole('button', { name: 'Continuar' }).click();
		await page.getByRole('button', { name: 'Continuar' }).last().click();

		await page.getByRole('button', { name: 'Crear presupuesto' }).click();
		await expect(page.getByText(/Presupuesto P-\d+ creado/)).toBeVisible();
		await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
	}

	test('creates a quote with a customer and converts it into a sale', async ({ page }) => {
		await loginAsAdmin(page);
		await createQuote(page, true);

		await page.getByRole('button', { name: 'Convertir a venta' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByRole('button', { name: 'Crear venta' }).click();

		await expect(page.getByText(/Venta #\d+ creada desde P-\d+/)).toBeVisible();
		await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
	});

	test('registers a customer inline in the convert modal (D5)', async ({ page }) => {
		await loginAsAdmin(page);
		await createQuote(page, false);

		await page.getByRole('button', { name: 'Convertir a venta' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Paso obligatorio')).toBeVisible();
		await dialog.getByRole('button', { name: 'Nuevo cliente' }).click();
		await dialog.getByLabel('Nombre', { exact: true }).fill('Ana');
		await dialog.getByLabel('Apellido', { exact: true }).fill('Pérez');
		// IdInput espera solo dígitos (prefijo V- va aparte y maxlength=10).
		await dialog.getByPlaceholder('12345678').fill(`${documentNumber.slice(0, 7)}9`);

		await dialog.getByRole('button', { name: 'Crear venta' }).click();

		await expect(page.getByText(/Venta #\d+ creada desde P-\d+/)).toBeVisible();
		await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);
	});
});
