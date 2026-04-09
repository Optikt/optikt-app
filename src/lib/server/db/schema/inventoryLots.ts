import {
	pgTable,
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
import { purchaseOrderItems } from './purchaseOrders';
import { products } from './products';
import { lensCatalogItems } from './lenses';

// ============================================================================
// INVENTORY LOTS — Real inventory units (one lot per PO item)
// ============================================================================

export const inventoryLots = pgTable(
	'inventory_lots',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Auto-sequential lot number */
		lotNumber: integer('lot_number').notNull(),
		purchaseOrderItemId: uuid('purchase_order_item_id').notNull(),
		/** 'PRODUCT' | 'LENS' (denormalized for queries) */
		itemType: varchar('item_type').notNull(),
		/** FK: only for PRODUCT lots */
		productId: uuid('product_id'),
		/** FK: only for LENS lots (STOCK mode) */
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		/** Quantity that originally entered */
		quantityInitial: integer('quantity_initial').notNull(),
		/** Remaining available quantity (decremented on sale/adjustment) */
		quantityAvailable: integer('quantity_available').notNull(),
		/** Snapshot of purchase price at time of lot creation */
		unitPurchasePrice: doublePrecision('unit_purchase_price').notNull(),
		/** Sale price for this lot */
		unitSalePrice: doublePrecision('unit_sale_price').notNull(),
		/** BCV rate at time of purchase */
		bcvRateAtPurchase: doublePrecision('bcv_rate_at_purchase').notNull(),
		/** false when quantityAvailable = 0 */
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_inventory_lots_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_inventory_lots_lot_number').using(
			'btree',
			table.lotNumber.asc().nullsLast().op('int4_ops')
		),
		index('ix_inventory_lots_product_id').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_lots_lens_id').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_lots_po_item_id').using(
			'btree',
			table.purchaseOrderItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_lots_active_product').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops'),
			table.isActive.asc().nullsLast()
		),
		index('ix_inventory_lots_active_lens').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops'),
			table.isActive.asc().nullsLast()
		),
		foreignKey({
			columns: [table.purchaseOrderItemId],
			foreignColumns: [purchaseOrderItems.id],
			name: 'inventory_lots_po_item_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'inventory_lots_product_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'inventory_lots_lens_catalog_item_id_fkey'
		}).onDelete('restrict')
	]
);

export type InventoryLot = typeof inventoryLots.$inferSelect;
export type NewInventoryLot = typeof inventoryLots.$inferInsert;
