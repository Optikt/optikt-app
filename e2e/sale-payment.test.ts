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

test.describe('sale wizard → payment → estado', () => {
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
			sku: `E2E-PRD-${runId}`,
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
			quantity: 5,
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

	test('creates a sale from the wizard, registers a payment and settles it', async ({ page }) => {
		await loginAsAdmin(page);

		await page.goto('/sales/new');

		// Step 1 — pick the seeded customer by document number.
		await page.getByPlaceholder('12345678').fill(documentNumber);
		await expect(page.getByText('Seleccionado')).toBeVisible();
		await page.getByRole('button', { name: 'Continuar' }).click();

		// Step 2 — quick-add the seeded product.
		await page.getByPlaceholder('Buscar items...').fill(productName);
		await page
			.getByRole('button', { name: new RegExp(productName) })
			.first()
			.click();
		await page.getByRole('button', { name: 'Continuar' }).click();

		// Prescription confirmation modal (rendered after the step-2 button in the DOM).
		await page.getByRole('button', { name: 'Continuar' }).last().click();

		// Step 3 — register the sale.
		await page.getByRole('button', { name: 'Confirmar y Registrar Venta' }).click();
		await expect(page.getByText('Venta registrada exitosamente')).toBeVisible();
		await expect(page).toHaveURL(/\/sales\/[0-9a-f-]{36}$/);

		// Payment drawer on the sale detail.
		await page.getByRole('button', { name: /Cobrar \/ Registrar Pago/ }).click();
		await page.getByRole('button', { name: 'Bs · BCV' }).click();
		await page.getByRole('button', { name: 'Efectivo Bs' }).click();
		await page.getByLabel('Tasa BCV').fill('40');
		await page.getByRole('button', { name: 'Usar saldo' }).click();
		await page.getByRole('button', { name: 'Finalizar Venta' }).click();

		await expect(page.getByText('Pago registrado. La venta quedó cubierta.')).toBeVisible();
	});
});
