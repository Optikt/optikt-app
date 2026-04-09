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
import { suppliers } from './suppliers';
import { users } from './users';
import { enumValues } from './utils';
import { PurchaseOrderStatus, PurchaseOrderItemType } from '../../../shared/enums/purchaseTypes';
import { products } from './products';
import { lensCatalogItems } from './lenses';

// ============================================================================
// PURCHASE ORDER ENUMS
// ============================================================================

export const purchaseOrderStatusEnum = pgEnum(
	'purchase_order_status',
	enumValues(PurchaseOrderStatus)
);

export const purchaseOrderItemTypeEnum = pgEnum(
	'purchase_order_item_type',
	enumValues(PurchaseOrderItemType)
);

// ============================================================================
// PURCHASE ORDERS (Cabecera de Compra / Carga)
// ============================================================================

export const purchaseOrders = pgTable(
	'purchase_orders',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Sequential order number (PO-0001, PO-0002, ...) */
		orderNumber: integer('order_number').notNull(),
		supplierId: uuid('supplier_id').notNull(),
		/** Supplier invoice number */
		invoiceNumber: varchar('invoice_number'),
		/** Delivery note number */
		deliveryNoteNumber: varchar('delivery_note_number'),
		status: purchaseOrderStatusEnum().notNull().default('DRAFT'),
		/** Date of the purchase */
		orderDate: timestamp('order_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** BCV rate at time of purchase */
		bcvRate: doublePrecision('bcv_rate').notNull(),
		notes: varchar(),
		createdById: uuid('created_by_id').notNull(),
		/** User who confirmed the PO (null until confirmed) */
		confirmedById: uuid('confirmed_by_id'),
		confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'string' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_purchase_orders_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_purchase_orders_order_number').using(
			'btree',
			table.orderNumber.asc().nullsLast().op('int4_ops')
		),
		index('ix_purchase_orders_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_orders_order_date').using(
			'btree',
			table.orderDate.asc().nullsLast().op('timestamptz_ops')
		),
		index('ix_purchase_orders_status').using('btree', table.status.asc().nullsLast()),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'purchase_orders_supplier_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: 'purchase_orders_created_by_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.confirmedById],
			foreignColumns: [users.id],
			name: 'purchase_orders_confirmed_by_id_fkey'
		}).onDelete('set null')
	]
);

// ============================================================================
// PURCHASE ORDER ITEMS (Líneas de Compra)
// ============================================================================

export const purchaseOrderItems = pgTable(
	'purchase_order_items',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		purchaseOrderId: uuid('purchase_order_id').notNull(),
		itemType: purchaseOrderItemTypeEnum('item_type').notNull(),
		/** FK: only for PRODUCT items */
		productId: uuid('product_id'),
		/** FK: only for LENS items (STOCK mode only) */
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		quantity: integer().notNull(),
		/** Unit purchase price in USD BCV */
		unitPurchasePrice: doublePrecision('unit_purchase_price').notNull(),
		/** Proposed sale price in USD BCV */
		unitSalePrice: doublePrecision('unit_sale_price').notNull(),
		/** Whether IVA applies */
		appliesIva: boolean('applies_iva').notNull().default(true),
		/** IVA rate percentage (e.g. 16) */
		ivaRate: doublePrecision('iva_rate').notNull().default(16),
		/** Filled when PO is confirmed — FK to the generated lot */
		lotId: uuid('lot_id'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_purchase_order_items_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_purchase_order_items_po_id').using(
			'btree',
			table.purchaseOrderId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_items_product_id').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_items_lens_id').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.purchaseOrderId],
			foreignColumns: [purchaseOrders.id],
			name: 'purchase_order_items_po_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'purchase_order_items_product_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'purchase_order_items_lens_catalog_item_id_fkey'
		}).onDelete('restrict')
	]
);

// Type exports
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
