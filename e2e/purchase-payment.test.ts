import { expect, test, type Page } from '@playwright/test';
import type { Sql } from 'postgres';
import { loginAsAdmin } from './auth';
import {
	closeDatabase,
	connectDatabase,
	ensureAdmin,
	seedCreditPurchaseOrder,
	seedMaterial,
	seedProduct,
	seedSupplier,
	uniqueRunId
} from './fixtures';

test.describe('compra crédito → abonos → pronto pago → caja', () => {
	let sql: Sql;
	let purchaseOrderId = '';

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
			sku: `E2E-PO-${runId}`,
			stock: 0,
			purchasePrice: 1000,
			salePrice: 1500
		});
		const order = await seedCreditPurchaseOrder(sql, {
			createdById: adminId,
			supplierId,
			productId,
			label: `E2E-${runId}`
		});
		purchaseOrderId = order.id;
	});

	test.afterAll(async () => {
		await closeDatabase(sql);
	});

	test('confirms a credit PO, records partial payments, earns the discount and reports it in cash', async ({
		page
	}) => {
		await loginAsAdmin(page);

		await page.goto(`/purchases/${purchaseOrderId}`);
		await page.getByRole('button', { name: /^Confirmar$/ }).click();
		await page.getByRole('button', { name: /^Confirmar Orden$/ }).click();
		await expect(page.getByText('Orden confirmada').first()).toBeVisible();

		await addPayment(page, '300');
		await addPayment(page, '300');
		await expect(page.getByText(/USD\s+400,00/).first()).toBeVisible();

		await addPayment(page, '350', { applyEarlyPaymentBenefit: true });
		await expect(page.getByText('Completamente pagada').first()).toBeVisible();
		await expect(page.getByText(/USD\s+50,00/).first()).toBeVisible();

		await page.goto('/cash');
		await expect(page.getByText(/Descuentos en compras/).first()).toBeVisible();
		await expect(page.getByText(/USD\s+50,00/).first()).toBeVisible();
	});
});

async function addPayment(
	page: Page,
	amount: string,
	options: { applyEarlyPaymentBenefit?: boolean } = {}
) {
	await page.getByRole('button', { name: /Registrar pago/ }).click();
	await page.getByRole('button', { name: 'Bs · BCV' }).click();
	await page.getByRole('button', { name: 'Transferencia Bs' }).click();
	await page.getByLabel('USD BCV').fill(amount);
	await page.getByLabel('Tasa BCV').fill('40');
	await page.getByLabel('Número de transacción').fill(`E2E-${amount}-${Date.now()}`);
	await page.getByRole('button', { name: /Aplicar Pago/ }).click();

	if (options.applyEarlyPaymentBenefit) {
		await expect(page.getByText('Pronto pago disponible')).toBeVisible();
		await page.getByRole('button', { name: /Aplicar a esta PO/ }).click();
	}

	await expect(page.getByText('Pago registrado').first()).toBeVisible();
}
