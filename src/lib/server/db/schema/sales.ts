import {
	pgTable,
	varchar,
	index,
	uuid,
	timestamp,
	integer,
	doublePrecision,
	foreignKey,
	json
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { customers } from './customers';
import { products } from './products';
import { lensCatalogItems } from './lenses';

// ============================================================================
// SALES
// ============================================================================

export const sales = pgTable(
	'sales',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		customerId: uuid('customer_id').notNull(),
		sellerId: uuid('seller_id').notNull(),
		saleDate: timestamp('sale_date', { mode: 'date' }).notNull(),
		status: varchar().notNull().default('PENDING'),
		subtotal: doublePrecision().notNull(),
		discount: doublePrecision().notNull().default(0),
		total: doublePrecision().notNull(),
		paymentMethod: varchar('payment_method').notNull(),
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
		selectedTreatments: json('selected_treatments').$type<string[]>(),
		quantity: integer().notNull(),
		unitPrice: doublePrecision('unit_price').notNull(),
		discount: doublePrecision().notNull().default(0),
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

// Type exports
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;
