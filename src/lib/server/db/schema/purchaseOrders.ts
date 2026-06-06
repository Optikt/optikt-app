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
	date,
	foreignKey
} from 'drizzle-orm/pg-core';
import { suppliers } from './suppliers';
import { users } from './users';
import { enumValues } from './utils';
import {
	PurchaseOrderStatus,
	PurchaseOrderItemType,
	PurchaseDocumentType,
	PurchaseDiscountType,
	PurchasePaymentTerms
} from '../../../shared/enums/purchaseTypes';
import { CurrencyCode } from '../../../shared/enums/currencyTypes';
import { products } from './products';
import { lensCatalogItems } from './lenses';

// ============================================================================
// PURCHASE ORDER ENUMS
// ============================================================================

export const purchaseOrderStatusEnum = pgEnum(
	'purchase_order_status',
	enumValues(PurchaseOrderStatus)
);

export const purchaseDocumentTypeEnum = pgEnum(
	'purchase_document_type',
	enumValues(PurchaseDocumentType)
);

export const purchaseOrderItemTypeEnum = pgEnum(
	'purchase_order_item_type',
	enumValues(PurchaseOrderItemType)
);

export const purchaseDiscountTypeEnum = pgEnum(
	'purchase_discount_type',
	enumValues(PurchaseDiscountType)
);

export const purchasePaymentTermsEnum = pgEnum(
	'purchase_payment_terms',
	enumValues(PurchasePaymentTerms)
);

export const purchasePaymentCurrencyEnum = pgEnum(
	'purchase_payment_currency',
	enumValues(CurrencyCode)
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
		/** Manual review marker for draft orders */
		isReadyForReview: boolean('is_ready_for_review').notNull().default(false),
		/** INVOICE = Factura, DELIVERY_NOTE = Nota de entrega */
		documentType: purchaseDocumentTypeEnum('document_type').notNull().default('INVOICE'),
		/** Date of the purchase */
		orderDate: timestamp('order_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** BCV rate at time of purchase */
		bcvRate: doublePrecision('bcv_rate').notNull(),
		/**
		 * Currency in which the supplier's prices are expressed on the source document.
		 * USD = USD BCV (default), VES = Bolívares, EUR = Euro.
		 */
		sourceCurrency: varchar('source_currency', { length: 10 }).notNull().default('USD'),
		/**
		 * Alternative rate in Bs per currency unit (only set when sourceCurrency = EUR).
		 * EUR formula: price_eur * altRate / bcvRate = price_usd
		 */
		altRate: doublePrecision('alt_rate'),
		/** Payment terms for supplier settlement */
		paymentTerms: purchasePaymentTermsEnum('payment_terms').notNull().default('CONTADO'),
		/** Final due date for supplier credit settlement (null for cash purchases). */
		creditDueDate: date('credit_due_date'),
		/** Optional early-payment incentive percentage, independent from inventory cost. */
		earlyPaymentDiscountPercent: doublePrecision('early_payment_discount_percent'),
		earlyPaymentDiscountDeadline: date('early_payment_discount_deadline'),
		/**
		 * Settlement discount granted by supplier at payment time (e.g. cash discount).
		 * Lines stay at the delivery-note price; the discount only affects the
		 * invoice total and the per-lot net cost computed at confirmation.
		 */
		settlementDiscountType: purchaseDiscountTypeEnum('settlement_discount_type')
			.notNull()
			.default('NONE'),
		settlementDiscountValue: doublePrecision('settlement_discount_value').notNull().default(0),
		settlementDiscountNotes: varchar('settlement_discount_notes'),
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
		index('ix_purchase_orders_payment_terms').using('btree', table.paymentTerms.asc().nullsLast()),
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
// PURCHASE ORDER PAYMENTS
// ============================================================================

export const purchaseOrderPayments = pgTable(
	'purchase_order_payments',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		purchaseOrderId: uuid('purchase_order_id').notNull(),
		paymentNumber: integer('payment_number').notNull(),
		currencyCode: purchasePaymentCurrencyEnum('currency_code').notNull(),
		paymentDate: timestamp('payment_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** Amount entered in the payment's native currency */
		amount: doublePrecision().notNull(),
		/** BCV USD rate on payment day - always required as normalization base */
		bcvUsdRate: doublePrecision('bcv_usd_rate').notNull(),
		/** Method-specific rate to VES when the payment is not USD_BCV */
		specificRate: doublePrecision('specific_rate'),
		/** Computed amount in VES */
		amountBs: doublePrecision('amount_bs').notNull(),
		/** Computed amount normalized to USD BCV */
		amountUsdBcv: doublePrecision('amount_usd_bcv').notNull(),
		reference: varchar(),
		notes: varchar(),
		voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
		/** User who voided this payment (null if not voided) */
		voidedById: uuid('voided_by_id'),
		createdById: uuid('created_by_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_purchase_order_payments_id').using(
			'btree',
			table.id.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_payments_po_id').using(
			'btree',
			table.purchaseOrderId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_payments_payment_date').using(
			'btree',
			table.paymentDate.desc().nullsLast().op('timestamptz_ops')
		),
		uniqueIndex('uq_purchase_order_payments_po_number').using(
			'btree',
			table.purchaseOrderId.asc().nullsLast().op('uuid_ops'),
			table.paymentNumber.asc().nullsLast().op('int4_ops')
		),
		foreignKey({
			columns: [table.purchaseOrderId],
			foreignColumns: [purchaseOrders.id],
			name: 'purchase_order_payments_po_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: 'purchase_order_payments_created_by_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.voidedById],
			foreignColumns: [users.id],
			name: 'purchase_order_payments_voided_by_id_fkey'
		}).onDelete('restrict')
	]
);

// ============================================================================
// PURCHASE ORDER EARLY PAYMENT BENEFITS
// ============================================================================

export const purchaseOrderEarlyPaymentBenefits = pgTable(
	'purchase_order_early_payment_benefits',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		purchaseOrderId: uuid('purchase_order_id').notNull(),
		paymentId: uuid('payment_id'),
		benefitDate: date('benefit_date').notNull(),
		amountUsdBcv: doublePrecision('amount_usd_bcv').notNull(),
		appliedToBalance: boolean('applied_to_balance').notNull().default(true),
		note: varchar('note'),
		createdById: uuid('created_by_id').notNull(),
		voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
		voidedById: uuid('voided_by_id'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_purchase_order_early_payment_benefits_id').using(
			'btree',
			table.id.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_early_payment_benefits_po_id').using(
			'btree',
			table.purchaseOrderId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_early_payment_benefits_payment_id').using(
			'btree',
			table.paymentId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_purchase_order_early_payment_benefits_date').using(
			'btree',
			table.benefitDate.asc().nullsLast().op('date_ops')
		),
		foreignKey({
			columns: [table.purchaseOrderId],
			foreignColumns: [purchaseOrders.id],
			name: 'purchase_order_early_payment_benefits_po_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.paymentId],
			foreignColumns: [purchaseOrderPayments.id],
			name: 'purchase_order_early_payment_benefits_payment_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: 'purchase_order_early_payment_benefits_created_by_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.voidedById],
			foreignColumns: [users.id],
			name: 'purchase_order_early_payment_benefits_voided_by_id_fkey'
		}).onDelete('restrict')
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
		/** Persisted visual order within the purchase order. */
		lineNumber: integer('line_number').notNull(),
		itemType: purchaseOrderItemTypeEnum('item_type').notNull(),
		/** FK: only for PRODUCT items */
		productId: uuid('product_id'),
		/** FK: only for LENS items (STOCK mode only) */
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		quantity: integer().notNull(),
		/** Unit purchase price in USD BCV */
		unitPurchasePrice: doublePrecision('unit_purchase_price').notNull(),
		/** Unit purchase price before IVA in the source currency (VES or EUR) when not USD mode */
		unitPurchasePriceAlt: doublePrecision('unit_purchase_price_alt'),
		/** Proposed sale price in USD BCV */
		unitSalePrice: doublePrecision('unit_sale_price').notNull(),
		/** Explicit acknowledgment that one or more zero prices on this line are intentional. */
		isZeroPriceIntentional: boolean('is_zero_price_intentional').notNull().default(false),
		/** Whether IVA applies */
		appliesIva: boolean('applies_iva').notNull().default(true),
		/** IVA rate percentage (e.g. 16) */
		ivaRate: doublePrecision('iva_rate').notNull().default(16),
		/**
		 * Per-line review check. Used both during draft creation ("data filled")
		 * and during ready-for-review verification. Reset to false when the
		 * order is marked/unmarked ready or when material fields change.
		 */
		isReviewed: boolean('is_reviewed').notNull().default(false),
		/** Filled when PO is confirmed - FK to the generated lot */
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
		index('ix_purchase_order_items_po_line_number').using(
			'btree',
			table.purchaseOrderId.asc().nullsLast().op('uuid_ops'),
			table.lineNumber.asc().nullsLast().op('int4_ops')
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
export type PurchaseOrderPayment = typeof purchaseOrderPayments.$inferSelect;
export type NewPurchaseOrderPayment = typeof purchaseOrderPayments.$inferInsert;
export type PurchaseOrderEarlyPaymentBenefit =
	typeof purchaseOrderEarlyPaymentBenefits.$inferSelect;
export type NewPurchaseOrderEarlyPaymentBenefit =
	typeof purchaseOrderEarlyPaymentBenefits.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
