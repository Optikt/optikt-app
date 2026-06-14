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
import { prescriptions } from './prescriptions';
import { supplierTreatments, suppliers } from './suppliers';
import { inventoryLots } from './inventoryLots';
import { enumValues } from './utils';
import {
	SaleItemType,
	FreeItemCategory,
	FreeItemEnrichmentStatus
} from '../../../shared/enums/lensTypes';
import { SaleStatus } from '../../../shared/enums/salesTypes';

// ============================================================================
// SALE ITEM TYPE ENUM
// ============================================================================

export const saleItemTypeEnum = pgEnum('sale_item_type', enumValues(SaleItemType));
export const freeItemCategoryEnum = pgEnum('free_item_category', enumValues(FreeItemCategory));
export const freeItemEnrichmentStatusEnum = pgEnum(
	'free_item_enrichment_status',
	enumValues(FreeItemEnrichmentStatus)
);
export const saleStatusEnum = pgEnum('sale_status', enumValues(SaleStatus));

// ============================================================================
// SALES (ORDERS)
// ============================================================================

export const sales = pgTable(
	'sales',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Sequential order number assigned inside the transaction */
		orderNumber: integer('order_number').notNull(),
		customerId: uuid('customer_id').notNull(),
		sellerId: uuid('seller_id').notNull(),
		saleDate: timestamp('sale_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** PENDING → IN_PROGRESS → COMPLETED (auto when fully paid) → CANCELLED */
		status: saleStatusEnum('status').notNull().default('PENDING'),
		subtotal: doublePrecision().notNull(),
		/** Global discount value (fixed amount or percentage input) */
		discount: doublePrecision().notNull().default(0),
		/** 'FIXED' or 'PERCENTAGE' */
		discountType: varchar('discount_type').notNull().default('FIXED'),
		/** Tax rate snapshot at time of sale (e.g. 16) */
		snapshotTaxRate: doublePrecision('snapshot_tax_rate').notNull(),
		/** Final total in USD (after discount) */
		total: doublePrecision().notNull(),
		/** Sum of all payments converted to BCV USD */
		paidAmountBcvUsd: doublePrecision('paid_amount_bcv_usd').notNull().default(0),
		notes: varchar(),
		/** Reason for cancellation (required when cancelling) */
		cancellationReason: varchar('cancellation_reason', { length: 500 }),
		/** When the sale was cancelled */
		cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
		/** Who cancelled the sale */
		cancelledById: uuid('cancelled_by_id'),
		/** When the sale transitioned to COMPLETED (i.e. fully paid + delivered). Null otherwise. */
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
		/** Refund disposition: REFUNDED | RETAINED | NO_PAYMENT */
		refundStatus: varchar('refund_status', { length: 20 }),
		/** Amount refunded or retained (USD BCV) */
		refundAmount: doublePrecision('refund_amount'),
		/** Notes about the refund/retention decision */
		refundNotes: varchar('refund_notes', { length: 500 }),
		/** When the refund/retention decision was recorded */
		refundedAt: timestamp('refunded_at', { withTimezone: true, mode: 'string' }),
		/** Who recorded the refund/retention decision */
		refundedById: uuid('refunded_by_id'),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_sales_customer_id').using('btree', table.customerId.asc().nullsLast().op('uuid_ops')),
		index('ix_sales_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_sales_sale_date').using('btree', table.saleDate.asc().nullsLast()),
		index('ix_sales_seller_id').using('btree', table.sellerId.asc().nullsLast().op('uuid_ops')),
		index('ix_sales_completed_at').using('btree', table.completedAt.asc().nullsLast()),
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
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.cancelledById],
			foreignColumns: [users.id],
			name: 'sales_cancelled_by_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.refundedById],
			foreignColumns: [users.id],
			name: 'sales_refunded_by_id_fkey'
		}).onDelete('set null')
	]
);

// ============================================================================
// SALE ITEMS (redesigned - PRODUCT | LENS_PAIR | TREATMENT)
// ============================================================================

export const saleItems = pgTable(
	'sale_items',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		saleId: uuid('sale_id').notNull(),
		itemType: saleItemTypeEnum('item_type').notNull(),

		// --- Polymorphic FKs (only one set per itemType) ---
		/** FK: only for PRODUCT items */
		productId: uuid('product_id'),
		/** FK: only for LENS_PAIR items */
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		/** FK self-ref: only for TREATMENT items → parent LENS_PAIR */
		parentSaleItemId: uuid('parent_sale_item_id'),
		/** FK: only for TREATMENT items → which lab treatment */
		supplierTreatmentId: uuid('supplier_treatment_id'),
		/** FK: FIFO lot consumed (null for LENS_PAIR ON_DEMAND/LAB and TREATMENT) */
		lotId: uuid('lot_id'),

		// --- Prescription snapshot (only for LENS_PAIR) ---
		prescriptionId: uuid('prescription_id'),
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

		// --- Snapshot (immutable at time of sale) ---
		/** Display name (product name, lens description, treatment name) */
		snapshotName: varchar('snapshot_name'),
		/** Product SKU (PRODUCT only) */
		snapshotSku: varchar('snapshot_sku'),
		/** Brand name (PRODUCT) or Supplier name (LENS_PAIR, TREATMENT) */
		snapshotBrand: varchar('snapshot_brand'),
		/** Total real cost of this line (sum of consumed_qty × lot.unit_purchase_price across all lots) */
		snapshotCostTotal: doublePrecision('snapshot_cost_total'),
		/** Weighted average unit cost (snapshotCostTotal / quantity) */
		snapshotCostUnit: doublePrecision('snapshot_cost_unit'),
		/** Number of distinct FIFO lots consumed for this line item */
		snapshotLotsCount: integer('snapshot_lots_count'),
		/** Lens: per-unit cost price from catalog */
		snapshotBaseCost: doublePrecision('snapshot_base_cost'),
		/** Lens: mounting price from catalog */
		snapshotMountingPrice: doublePrecision('snapshot_mounting_price'),
		/** Lens: shipping price from catalog */
		snapshotShippingPrice: doublePrecision('snapshot_shipping_price'),
		/** Lens: sale price per unit from catalog (the price we set as suggested sell) */
		snapshotSalePrice: doublePrecision('snapshot_sale_price'),
		/** Lens: price type from catalog ('UNIT' or 'PAIR') */
		snapshotPriceType: varchar('snapshot_price_type'),
		/** Treatment: category (AR, BLUECUT, etc.) */
		snapshotTreatmentCategory: varchar('snapshot_treatment_category'),

		// --- Tax snapshot ---
		/** Whether the item was taxable at time of sale */
		snapshotIsTaxable: boolean('snapshot_is_taxable'),

		/** Whether the shipping cost is pending (unknown at time of sale) */
		shippingCostPending: boolean('shipping_cost_pending').default(false),

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
		index('ix_sale_items_parent_id').using(
			'btree',
			table.parentSaleItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_sale_items_lot_id').using('btree', table.lotId.asc().nullsLast().op('uuid_ops')),
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
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.parentSaleItemId],
			foreignColumns: [table.id],
			name: 'sale_items_parent_sale_item_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.supplierTreatmentId],
			foreignColumns: [supplierTreatments.id],
			name: 'sale_items_supplier_treatment_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.lotId],
			foreignColumns: [inventoryLots.id],
			name: 'sale_items_lot_id_fkey'
		}).onDelete('restrict')
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
		/** Date when the payment was actually received */
		paymentDate: timestamp('payment_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** Computed BCV USD equivalent: for Bs methods = amount / bcvRate, otherwise = (amount * exchangeRate) / bcvRate */
		amountBcvUsd: doublePrecision('amount_bcv_usd').notNull(),
		/** Payment reference number (transfer ref, etc.) */
		reference: varchar(),
		notes: varchar(),
		/** Voided payment marker */
		voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
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

// ============================================================================
// SALE ITEM FREE DETAILS (1:1 extension for FREE_ITEM sale items)
// ============================================================================

export const saleItemFreeDetails = pgTable(
	'sale_item_free_details',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** 1:1 FK → sale_items(id) — only exists for FREE_ITEM rows */
		saleItemId: uuid('sale_item_id').notNull().unique(),
		/** Structured category for the free item */
		category: freeItemCategoryEnum().notNull(),
		/** Free-text description (required) */
		description: varchar({ length: 500 }).notNull(),
		/** PENDING until enriched via enrichFreeItem */
		enrichmentStatus: freeItemEnrichmentStatusEnum('enrichment_status')
			.notNull()
			.default('PENDING'),
		/** Cost per unit in USD — NULL when not yet known */
		unitCost: doublePrecision('unit_cost'),
		/** FK: supplier used for this specific order — NULL when not yet known */
		supplierId: uuid('supplier_id'),
		/** Free text for prescription / optical specs */
		opticalNotes: varchar('optical_notes', { length: 1000 }),
		/** When enrichment was completed */
		enrichedAt: timestamp('enriched_at', { withTimezone: true, mode: 'string' }),
		/** Who enriched the item */
		enrichedById: uuid('enriched_by_id'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_sale_item_free_details_sale_item_id').using(
			'btree',
			table.saleItemId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.saleItemId],
			foreignColumns: [saleItems.id],
			name: 'sale_item_free_details_sale_item_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'sale_item_free_details_supplier_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.enrichedById],
			foreignColumns: [users.id],
			name: 'sale_item_free_details_enriched_by_id_fkey'
		}).onDelete('set null')
	]
);

export type SaleItemFreeDetails = typeof saleItemFreeDetails.$inferSelect;
export type NewSaleItemFreeDetails = typeof saleItemFreeDetails.$inferInsert;
