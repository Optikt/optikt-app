import {
	pgTable,
	pgEnum,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	boolean,
	integer,
	doublePrecision,
	foreignKey
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { customers } from './customers';
import { products } from './products';
import { lensCatalogItems } from './lenses';
import { supplierTreatments } from './suppliers';
import { sales } from './sales';
import { enumValues } from './utils';
import { QuoteStatus } from '../../../shared/contracts/quotes';

// ============================================================================
// QUOTE STATUS ENUM
// ============================================================================

export const quoteStatusEnum = pgEnum('quote_status', enumValues(QuoteStatus));

// ============================================================================
// QUOTES (PRESUPUESTOS)
// ============================================================================

export const quotes = pgTable(
	'quotes',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Sequential quote number assigned inside the transaction */
		quoteNumber: integer('quote_number').notNull(),
		/** Customer is optional at quote time, required at conversion */
		customerId: uuid('customer_id'),
		/** Who created the quote */
		sellerId: uuid('seller_id').notNull(),
		quoteDate: timestamp('quote_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** DRAFT → CONVERTED | CANCELLED | EXPIRED */
		status: quoteStatusEnum().notNull().default('DRAFT'),
		subtotal: doublePrecision().notNull(),
		/** Global discount value (fixed amount or percentage input) */
		discount: doublePrecision().notNull().default(0),
		/** 'FIXED' or 'PERCENTAGE' */
		discountType: varchar('discount_type').notNull().default('FIXED'),
		/** Final total in USD (after discount) */
		total: doublePrecision().notNull(),
		/** FK to created sale when converted */
		conversionSaleId: uuid('conversion_sale_id'),
		/** Optional expiration date */
		validUntil: timestamp('valid_until', { withTimezone: true, mode: 'string' }),
		notes: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_quotes_customer_id').using(
			'btree',
			table.customerId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_quotes_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_quotes_quote_date').using(
			'btree',
			table.quoteDate.asc().nullsLast()
		),
		index('ix_quotes_seller_id').using('btree', table.sellerId.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_quotes_quote_number').using(
			'btree',
			table.quoteNumber.asc().nullsLast().op('int4_ops')
		),
		foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: 'quotes_customer_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.sellerId],
			foreignColumns: [users.id],
			name: 'quotes_seller_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.conversionSaleId],
			foreignColumns: [sales.id],
			name: 'quotes_conversion_sale_id_fkey'
		}).onDelete('set null')
	]
);

// ============================================================================
// QUOTE ITEMS (same polymorphic design as sale_items)
// ============================================================================

/** Reuse the sale_item_type enum for quote items */
export const quoteItems = pgTable(
	'quote_items',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		quoteId: uuid('quote_id').notNull(),
		itemType: varchar('item_type').notNull(),

		// --- Polymorphic FKs (only one set per itemType) ---
		productId: uuid('product_id'),
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		/** Self-ref: only for TREATMENT items → parent LENS_PAIR */
		parentQuoteItemId: uuid('parent_quote_item_id'),
		supplierTreatmentId: uuid('supplier_treatment_id'),

		// --- Prescription snapshot (only for LENS_PAIR) ---
		odSphere: doublePrecision('od_sphere'),
		odCylinder: doublePrecision('od_cylinder'),
		odAxis: integer('od_axis'),
		odAddition: doublePrecision('od_addition'),
		osSphere: doublePrecision('os_sphere'),
		osCylinder: doublePrecision('os_cylinder'),
		osAxis: integer('os_axis'),
		osAddition: doublePrecision('os_addition'),

		// --- Pricing ---
		quantity: integer().notNull(),
		unitPrice: doublePrecision('unit_price').notNull(),
		discount: doublePrecision().notNull().default(0),
		discountType: varchar('discount_type').notNull().default('FIXED'),

		// --- Snapshot (immutable at time of quote) ---
		snapshotName: varchar('snapshot_name'),
		snapshotSku: varchar('snapshot_sku'),
		snapshotBrand: varchar('snapshot_brand'),
		snapshotBaseCost: doublePrecision('snapshot_base_cost'),
		snapshotMountingPrice: doublePrecision('snapshot_mounting_price'),
		snapshotShippingPrice: doublePrecision('snapshot_shipping_price'),
		snapshotSalePrice: doublePrecision('snapshot_sale_price'),
		snapshotPriceType: varchar('snapshot_price_type'),
		snapshotTreatmentCategory: varchar('snapshot_treatment_category'),

		// --- Tax snapshot ---
		/** Whether the item was taxable at time of quote */
		snapshotIsTaxable: boolean('snapshot_is_taxable'),
		/** Tax rate at time of quote (e.g. 16) */
		snapshotTaxRate: doublePrecision('snapshot_tax_rate'),

		notes: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_quote_items_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_quote_items_quote_id').using('btree', table.quoteId.asc().nullsLast().op('uuid_ops')),
		index('ix_quote_items_product_id').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_quote_items_lens_catalog_item_id').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_quote_items_parent_id').using(
			'btree',
			table.parentQuoteItemId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.quoteId],
			foreignColumns: [quotes.id],
			name: 'quote_items_quote_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'quote_items_product_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'quote_items_lens_catalog_item_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.parentQuoteItemId],
			foreignColumns: [table.id],
			name: 'quote_items_parent_quote_item_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.supplierTreatmentId],
			foreignColumns: [supplierTreatments.id],
			name: 'quote_items_supplier_treatment_id_fkey'
		}).onDelete('restrict')
	]
);

// Type exports
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
