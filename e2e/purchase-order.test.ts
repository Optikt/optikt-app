import { expect, test } from '@playwright/test';
import postgres, { type Sql } from 'postgres';
import { hash } from '@node-rs/argon2';
import { adminEmail, adminPassword, loginAsAdmin } from './auth';

const databaseUrl = process.env.DATABASE_URL;
const argonOptions = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

test.describe('purchase order confirm', () => {
	let sql: Sql;
	let purchaseOrderId = '';

	test.beforeAll(async () => {
		if (!databaseUrl) throw new Error('DATABASE_URL is required for purchase order E2E');
		sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
		purchaseOrderId = await seedCreditPurchaseOrder(sql);
	});

	test.afterAll(async () => {
		if (sql) await sql.end({ timeout: 5 });
	});

	test('confirms a draft credit purchase order from the UI', async ({ page }) => {
		await loginAsAdmin(page);

		await page.goto(`/purchases/${purchaseOrderId}`);
		await page.getByRole('button', { name: /^Confirmar$/ }).click();
		await page.getByRole('button', { name: /^Confirmar Orden$/ }).click();
		await expect(page.getByText('Orden confirmada').first()).toBeVisible();
	});
});

async function seedCreditPurchaseOrder(sql: Sql): Promise<string> {
	const runId = crypto.randomUUID().slice(0, 8);
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const dueDate = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
	const hashedPassword = await hash(adminPassword, argonOptions);

	const [user] = await sql<{ id: string }[]>`
		insert into users (email, username, full_name, hashed_password, is_superuser, role)
		values (${adminEmail}, ${`e2e-${runId}`}, 'Optikt E2E Admin', ${hashedPassword}, true, 'ADMIN')
		on conflict (email) do update set role = 'ADMIN'
		returning id
	`;

	const [supplier] = await sql<{ id: string }[]>`
		insert into suppliers (name, type, primary_phone, default_currency)
		values (${`Proveedor E2E ${runId}`}, 'DISTRIBUTOR', '04120000000', 'USD_BCV')
		returning id
	`;

	const [material] = await sql<{ id: string }[]>`
		insert into materials (name, code, product_type)
		values (${`Acetato E2E ${runId}`}, ${`E2E-${runId}`}, 'FRAME')
		returning id
	`;

	const [product] = await sql<{ id: string }[]>`
		insert into products (
			sku, name, type, supplier_id, material_id,
			current_purchase_price, current_sale_price, stock, min_stock
		)
		values (
			${`E2E-PO-${runId}`}, ${`Montura E2E ${runId}`}, 'FRAME', ${supplier.id}, ${material.id},
			1000, 1500, 0, 1
		)
		returning id
	`;

	const [orderNumberRow] = await sql<{ orderNumber: number }[]>`
		select coalesce(max(order_number), 0) + 1 as "orderNumber" from purchase_orders
	`;

	const [purchaseOrder] = await sql<{ id: string }[]>`
		insert into purchase_orders (
			order_number, supplier_id, invoice_number, status, is_ready_for_review,
			document_type, order_date, bcv_rate, source_currency, payment_terms,
			credit_due_date, early_payment_discount_percent, early_payment_discount_deadline,
			settlement_discount_type, settlement_discount_value, settlement_currency,
			settlement_gross_amount, settlement_debt_amount, settlement_debt_amount_usd_bcv_at_order,
			notes, created_by_id
		)
		values (
			${orderNumberRow.orderNumber}, ${supplier.id}, ${`E2E-${runId}`}, 'DRAFT', true,
			'INVOICE', ${now.toISOString()}, 40, 'USD', 'CREDIT',
			${dueDate}, 5, ${today},
			'NONE', 0, 'USD_BCV',
			1000, 1000, 1000,
			'Orden E2E para pronto pago', ${user.id}
		)
		returning id
	`;

	await sql`
		insert into purchase_order_items (
			purchase_order_id, line_number, item_type, product_id, quantity,
			unit_purchase_price, unit_sale_price, applies_iva, iva_rate, is_reviewed
		)
		values (${purchaseOrder.id}, 1, 'PRODUCT', ${product.id}, 1, 1000, 1500, false, 0, true)
	`;

	return purchaseOrder.id;
}
