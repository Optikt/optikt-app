import { expect, test, type Page } from '@playwright/test';
import postgres, { type Sql } from 'postgres';
import { hash } from '@node-rs/argon2';

const runPurchaseFlow = process.env.OPTIKT_RUN_PURCHASE_E2E === 'true';
const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.OPTIKT_E2E_ADMIN_EMAIL ?? 'optikt.vision@gmail.com';
const adminPassword = process.env.OPTIKT_E2E_ADMIN_PASSWORD ?? 'Admin_123';
const argonOptions = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

test.describe('purchase order credit payment flow', () => {
	test.skip(
		!runPurchaseFlow,
		'Set OPTIKT_RUN_PURCHASE_E2E=true with a seeded DATABASE_URL to run this flow.'
	);

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

	test('confirms a credit PO, records partial payments, earns discount, and reports it in cash', async ({
		page
	}) => {
		await page.goto('/login');
		await page.getByLabel('Correo Electrónico').fill(adminEmail);
		await page.getByLabel('Contraseña').fill(adminPassword);
		await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
		await expect(page.getByRole('heading', { name: /Centro de Operaciones/ })).toBeVisible();

		await page.goto(`/purchases/${purchaseOrderId}`);
		await page.getByRole('button', { name: /^Confirmar orden$/ }).click();
		await page.getByRole('button', { name: /^Confirmar Orden$/ }).click();
		await expect(page.getByText('Orden confirmada')).toBeVisible();

		await addPayment(page, '300');
		await addPayment(page, '300');
		await expect(page.getByText(/USD\s+400,00/)).toBeVisible();

		await addPayment(page, '350', { applyEarlyPaymentBenefit: true });
		await expect(page.getByText('Completamente pagada')).toBeVisible();
		await expect(page.getByText(/USD\s+50,00/)).toBeVisible();
		await expect(page.getByText('Pago registrado').first()).toBeVisible();

		await page.goto('/cash');
		await expect(page.getByText('Desc. compras').first()).toBeVisible();
		await expect(page.getByText(/USD\s+50,00/).first()).toBeVisible();
	});
});

async function addPayment(
	page: Page,
	amount: string,
	options: { applyEarlyPaymentBenefit?: boolean } = {}
) {
	await page.getByRole('button', { name: /Registrar pago/ }).click();
	await page.getByLabel('Monto pagado').fill(amount);
	await page.getByLabel('Tasa BCV USD').fill('40');
	await page.getByLabel('Referencia').fill(`E2E-${amount}-${Date.now()}`);
	await page.getByRole('button', { name: /Guardar pago/ }).click();
	if (options.applyEarlyPaymentBenefit) {
		await expect(page.getByText('Pronto pago disponible')).toBeVisible();
		await page.getByRole('button', { name: /Aplicar a esta PO/ }).click();
	}
	await expect(page.getByText('Pago registrado')).toBeVisible();
}

async function seedCreditPurchaseOrder(sql: Sql): Promise<string> {
	const runId = crypto.randomUUID().slice(0, 8);
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const dueDate = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
	const hashedPassword = await hash(adminPassword, argonOptions);

	const [user] = await sql<{ id: string }[]>`
		insert into users (email, username, full_name, hashed_password, is_active, is_superuser, role)
		values (${adminEmail}, ${`e2e-${runId}`}, 'Optikt E2E Admin', ${hashedPassword}, true, true, 'ADMIN')
		on conflict (email) do update set role = 'ADMIN', is_active = true
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
			current_purchase_price, current_sale_price, stock, min_stock, is_active
		)
		values (
			${`E2E-PO-${runId}`}, ${`Montura E2E ${runId}`}, 'FRAME', ${supplier.id}, ${material.id},
			1000, 1500, 0, 1, true
		)
		returning id
	`;

	const [orderNumberRow] = await sql<{ orderNumber: number }[]>`
		select coalesce(max(order_number), 0) + 1 as "orderNumber" from purchase_orders
	`;

	const [purchaseOrder] = await sql<{ id: string }[]>`
		insert into purchase_orders (
			order_number, supplier_id, invoice_number, status, is_ready_for_review,
			document_type, order_date, bcv_rate, payment_terms,
			credit_due_date, early_payment_discount_percent, early_payment_discount_deadline,
			settlement_discount_type, settlement_discount_value, notes, created_by_id
		)
		values (
			${orderNumberRow.orderNumber}, ${supplier.id}, ${`E2E-${runId}`}, 'DRAFT', true,
			'INVOICE', ${now.toISOString()}, 40, 'CREDIT',
			${dueDate}, 5, ${today},
			'NONE', 0, 'Orden E2E para pronto pago', ${user.id}
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
