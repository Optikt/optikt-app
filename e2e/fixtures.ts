import { hash } from '@node-rs/argon2';
import postgres, { type Sql } from 'postgres';
import { adminEmail, adminPassword } from './auth';

const argonOptions = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

export function connectDatabase(): Sql {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is required for E2E');
	return postgres(url, { max: 1, onnotice: () => {} });
}

export async function closeDatabase(sql: Sql | undefined): Promise<void> {
	if (sql) await sql.end({ timeout: 5 });
}

/** Numeric run id, safe for document numbers and unique across tests. */
export function uniqueRunId(): string {
	return String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 90) + 10);
}

export async function ensureAdmin(sql: Sql): Promise<string> {
	const hashedPassword = await hash(adminPassword, argonOptions);
	const [user] = await sql<{ id: string }[]>`
		insert into users (email, username, full_name, hashed_password, is_superuser, role)
		values (${adminEmail}, ${'e2e-admin'}, 'Optikt E2E Admin', ${hashedPassword}, true, 'ADMIN')
		on conflict (email) do update set role = 'ADMIN'
		returning id
	`;
	return user.id;
}

export async function seedSupplier(sql: Sql, label: string): Promise<string> {
	const [supplier] = await sql<{ id: string }[]>`
		insert into suppliers (name, type, primary_phone, default_currency)
		values (${label}, 'DISTRIBUTOR', '04120000000', 'USD_BCV')
		returning id
	`;
	return supplier.id;
}

export async function seedMaterial(sql: Sql, name: string, code: string): Promise<string> {
	const [material] = await sql<{ id: string }[]>`
		insert into materials (name, code, product_type)
		values (${name}, ${code}, 'FRAME')
		returning id
	`;
	return material.id;
}

export async function seedProduct(
	sql: Sql,
	input: {
		supplierId: string;
		materialId: string;
		name: string;
		sku: string;
		stock: number;
		purchasePrice: number;
		salePrice: number;
	}
): Promise<string> {
	const [product] = await sql<{ id: string }[]>`
		insert into products (
			sku, name, type, supplier_id, material_id,
			current_purchase_price, current_sale_price, stock, min_stock
		)
		values (
			${input.sku}, ${input.name}, 'FRAME', ${input.supplierId}, ${input.materialId},
			${input.purchasePrice}, ${input.salePrice}, ${input.stock}, 1
		)
		returning id
	`;
	return product.id;
}

export async function seedCustomer(
	sql: Sql,
	input: { firstName: string; lastName: string; idNumber: string; phone?: string }
): Promise<string> {
	const [customer] = await sql<{ id: string }[]>`
		insert into customers (first_name, last_name, id_number, primary_phone)
		values (${input.firstName}, ${input.lastName}, ${input.idNumber}, ${input.phone ?? '04120000000'})
		returning id
	`;
	return customer.id;
}

export async function seedCreditPurchaseOrder(
	sql: Sql,
	input: { createdById: string; supplierId: string; productId: string; label: string }
): Promise<{ id: string; orderNumber: number; itemId: string }> {
	const now = new Date();
	const today = now.toISOString().slice(0, 10);
	const dueDate = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

	const [orderNumberRow] = await sql<{ orderNumber: number }[]>`
		select coalesce(max(order_number), 0) + 1 as "orderNumber" from purchase_orders
	`;
	const orderNumber = orderNumberRow.orderNumber;

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
			${orderNumber}, ${input.supplierId}, ${input.label}, 'DRAFT', true,
			'INVOICE', ${now.toISOString()}, 40, 'USD', 'CREDIT',
			${dueDate}, 5, ${today},
			'NONE', 0, 'USD_BCV',
			1000, 1000, 1000,
			${`Orden E2E ${input.label}`}, ${input.createdById}
		)
		returning id
	`;

	const [item] = await sql<{ id: string }[]>`
		insert into purchase_order_items (
			purchase_order_id, line_number, item_type, product_id, quantity,
			unit_purchase_price, unit_sale_price, applies_iva, iva_rate, is_reviewed
		)
		values (${purchaseOrder.id}, 1, 'PRODUCT', ${input.productId}, 1, 1000, 1500, false, 0, true)
		returning id
	`;

	return { id: purchaseOrder.id, orderNumber, itemId: item.id };
}

/** Real inventory stock: a lot the sale FIFO can consume. Also syncs products.stock. */
export async function seedInventoryLot(
	sql: Sql,
	input: {
		purchaseOrderItemId: string;
		productId: string;
		quantity: number;
		purchasePrice: number;
		salePrice: number;
	}
): Promise<void> {
	const [lotNumberRow] = await sql<{ lotNumber: number }[]>`
		select coalesce(max(lot_number), 0) + 1 as "lotNumber" from inventory_lots
	`;

	await sql`
		insert into inventory_lots (
			lot_number, purchase_order_item_id, item_type, product_id,
			quantity_initial, quantity_available, unit_purchase_price, unit_sale_price,
			bcv_rate_at_purchase, is_active
		)
		values (
			${lotNumberRow.lotNumber}, ${input.purchaseOrderItemId}, 'PRODUCT', ${input.productId},
			${input.quantity}, ${input.quantity}, ${input.purchasePrice}, ${input.salePrice},
			40, true
		)
	`;

	await sql`update products set stock = ${input.quantity} where id = ${input.productId}`;
}

export async function seedOpenCountSession(
	sql: Sql,
	input: { openedById: string; productId: string; systemStock: number; countedStock: number }
): Promise<number> {
	const [session] = await sql<{ id: number }[]>`
		insert into inventory_count_sessions (status, scope_type, opened_by_id)
		values ('OPEN', 'PRODUCT_CATEGORY', ${input.openedById})
		returning id
	`;

	await sql`
		insert into inventory_count_lines (
			session_id, item_type, product_id, system_stock, counted_stock, difference, counted_by_id, counted_at
		)
		values (
			${session.id}, 'PRODUCT', ${input.productId}, ${input.systemStock},
			${input.countedStock}, ${input.countedStock - input.systemStock}, ${input.openedById}, now()
		)
	`;

	return session.id;
}

export async function seedQuote(
	sql: Sql,
	input: {
		sellerId: string;
		customerId: string | null;
		productId: string;
		label: string;
		unitPrice: number;
	}
): Promise<string> {
	const [numberRow] = await sql<{ quoteNumber: number }[]>`
		select coalesce(max(quote_number), 0) + 1 as "quoteNumber" from quotes
	`;
	const total = input.unitPrice;

	const [quote] = await sql<{ id: string }[]>`
		insert into quotes (
			quote_number, customer_id, seller_id, quote_date, status,
			subtotal, discount, discount_type, snapshot_tax_rate, total
		)
		values (
			${numberRow.quoteNumber}, ${input.customerId}, ${input.sellerId}, now(), 'DRAFT',
			${total}, 0, 'FIXED', 16, ${total}
		)
		returning id
	`;

	await sql`
		insert into quote_items (
			quote_id, item_type, product_id, quantity, unit_price, discount, discount_type,
			snapshot_name, snapshot_sku, snapshot_sale_price, snapshot_is_taxable
		)
		values (
			${quote.id}, 'PRODUCT', ${input.productId}, 1, ${input.unitPrice}, 0, 'FIXED',
			${input.label}, ${input.label}, ${input.unitPrice}, false
		)
	`;

	return quote.id;
}
