import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	integer,
	doublePrecision,
	foreignKey,
	json,
	serial
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { customers } from './customers';
import { products } from './products';
import { lensCatalogItems } from './lenses';
import { prescriptions } from './prescriptions';

// ============================================================================
// SALES (ORDERS)
// ============================================================================

export const sales = pgTable(
	'sales',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Auto-incrementing order number starting at 1 */
		orderNumber: serial('order_number').notNull(),
		customerId: uuid('customer_id').notNull(),
		sellerId: uuid('seller_id').notNull(),
		saleDate: timestamp('sale_date', { mode: 'date' }).notNull(),
		/** PENDING → COMPLETED (auto when fully paid) → CANCELLED */
		status: varchar().notNull().default('PENDING'),
		subtotal: doublePrecision().notNull(),
		/** Global discount value (fixed amount or percentage input) */
		discount: doublePrecision().notNull().default(0),
		/** 'FIXED' or 'PERCENTAGE' */
		discountType: varchar('discount_type').notNull().default('FIXED'),
		/** Final total in USD (after discount) */
		total: doublePrecision().notNull(),
		/** Sum of all payments converted to BCV USD */
		paidAmountBcvUsd: doublePrecision('paid_amount_bcv_usd').notNull().default(0),
		notes: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_sales_customer_id').using('btree', table.customerId.asc().nullsLast().op('uuid_ops')),
		index('ix_sales_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_sales_sale_date').using(
			'btree',
			table.saleDate.asc().nullsLast().op('timestamp_ops')
		),
		index('ix_sales_seller_id').using('btree', table.sellerId.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_sales_order_number').using(
			'btree',
			table.orderNumber.asc().nullsLast().op('int4_ops')
		),
		foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: 'sales_customer_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.sellerId],
			foreignColumns: [users.id],
			name: 'sales_seller_id_fkey'
		}).onDelete('restrict')
	]
);

// ============================================================================
// SALE ITEMS
// ============================================================================

export const saleItems = pgTable(
	'sale_items',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		saleId: uuid('sale_id').notNull(),
		productId: uuid('product_id'),
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		lensFulfillmentMode: varchar('lens_fulfillment_mode'),
		selectedTreatments: json('selected_treatments').$type<string[]>(),
		/** Link to customer prescription used for this lens item */
		prescriptionId: uuid('prescription_id'),
		/** Snapshot: Right eye sphere at time of sale */
		odSphere: doublePrecision('od_sphere'),
		/** Snapshot: Right eye cylinder at time of sale */
		odCylinder: doublePrecision('od_cylinder'),
		/** Snapshot: Right eye axis at time of sale */
		odAxis: integer('od_axis'),
		/** Snapshot: Right eye addition at time of sale */
		odAddition: doublePrecision('od_addition'),
		/** Snapshot: Left eye sphere at time of sale */
		osSphere: doublePrecision('os_sphere'),
		/** Snapshot: Left eye cylinder at time of sale */
		osCylinder: doublePrecision('os_cylinder'),
		/** Snapshot: Left eye axis at time of sale */
		osAxis: integer('os_axis'),
		/** Snapshot: Left eye addition at time of sale */
		osAddition: doublePrecision('os_addition'),
		quantity: integer().notNull(),
		unitPrice: doublePrecision('unit_price').notNull(),
		/** Item discount value (fixed amount or percentage input) */
		discount: doublePrecision().notNull().default(0),
		/** 'FIXED' or 'PERCENTAGE' */
		discountType: varchar('discount_type').notNull().default('FIXED'),
		notes: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_sale_items_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_sale_items_lens_catalog_item_id').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_sale_items_prescription_id').using(
			'btree',
			table.prescriptionId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_sale_items_product_id').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_sale_items_sale_id').using('btree', table.saleId.asc().nullsLast().op('uuid_ops')),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'sale_items_lens_catalog_item_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.prescriptionId],
			foreignColumns: [prescriptions.id],
			name: 'sale_items_prescription_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'sale_items_product_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: 'sale_items_sale_id_fkey'
		}).onDelete('cascade')
	]
);

// ============================================================================
// SALE PAYMENTS
// ============================================================================

export const salePayments = pgTable(
	'sale_payments',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		saleId: uuid('sale_id').notNull(),
		/** Payment method enum value */
		paymentMethod: varchar('payment_method').notNull(),
		/** Amount in the native currency of the payment method */
		amount: doublePrecision().notNull(),
		/**
		 * Method-specific exchange rate to VES.
		 * - Bs methods: null (they ARE in Bs, use bcvRate directly)
		 * - Efectivo $: street $/Bs rate (e.g. 520 Bs per $)
		 * - Binance USDT: USDT/Bs rate (e.g. 602 Bs per USDT)
		 */
		exchangeRate: doublePrecision('exchange_rate'),
		/** BCV Bs/$ official rate at payment time (always required) */
		bcvRate: doublePrecision('bcv_rate').notNull(),
		/** Computed BCV USD equivalent: for Bs methods = amount / bcvRate, otherwise = (amount * exchangeRate) / bcvRate */
		amountBcvUsd: doublePrecision('amount_bcv_usd').notNull(),
		/** Payment reference number (transfer ref, etc.) */
		reference: varchar(),
		notes: varchar(),
		/** Voided payment marker */
		voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_sale_payments_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_sale_payments_sale_id').using('btree', table.saleId.asc().nullsLast().op('uuid_ops')),
		foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: 'sale_payments_sale_id_fkey'
		}).onDelete('cascade')
	]
);

// Type exports
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;
export type SalePayment = typeof salePayments.$inferSelect;
export type NewSalePayment = typeof salePayments.$inferInsert;
