import {
	pgTable,
	pgEnum,
	varchar,
	index,
	uuid,
	timestamp,
	foreignKey,
	json
} from 'drizzle-orm/pg-core';
import { lensCatalogItems } from './lenses';
import { suppliers } from './suppliers';
import { sales } from './sales';
import { SurplusOriginType, SurplusUnitStatus } from '../../../shared/contracts/fulfillment';
import type { LensPhysicalSignature, FulfillmentCostBreakdown } from '../../../shared/contracts';
import { enumValues } from './utils';

// ============================================================================
// SURPLUS ENUMS — derived from shared contracts (single source of truth)
// ============================================================================

export const surplusOriginTypeEnum = pgEnum('surplus_origin_type', enumValues(SurplusOriginType));
export const surplusUnitStatusEnum = pgEnum('surplus_unit_status', enumValues(SurplusUnitStatus));

// ============================================================================
// SURPLUS UNITS — physical lens units from pair purchase excess
// ============================================================================

export const surplusUnits = pgTable(
	'surplus_units',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),

		// --- Origin traceability ---
		originType: surplusOriginTypeEnum('origin_type').notNull(),
		originSaleId: uuid('origin_sale_id'),

		// --- What this unit is ---
		catalogItemId: uuid('catalog_item_id').notNull(),
		supplierId: uuid('supplier_id').notNull(),
		physicalSignature: json('physical_signature').$type<LensPhysicalSignature>().notNull(),

		// --- Lifecycle ---
		status: surplusUnitStatusEnum().notNull().default('AVAILABLE'),

		// --- Cost snapshot at creation time ---
		costSnapshot: json('cost_snapshot').$type<FulfillmentCostBreakdown>().notNull(),

		// --- Consumption traceability ---
		consumedBySaleId: uuid('consumed_by_sale_id'),
		reservedForSaleId: uuid('reserved_for_sale_id'),
		reservedAt: timestamp('reserved_at', { withTimezone: true, mode: 'date' }),

		// --- Notes ---
		notes: varchar(),

		// --- Timestamps ---
		consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
		voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_surplus_units_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_surplus_units_catalog_item_id').using(
			'btree',
			table.catalogItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_surplus_units_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_surplus_units_status').using('btree', table.status),
		index('ix_surplus_units_origin_sale_id').using(
			'btree',
			table.originSaleId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.catalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'surplus_units_catalog_item_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'surplus_units_supplier_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.originSaleId],
			foreignColumns: [sales.id],
			name: 'surplus_units_origin_sale_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.consumedBySaleId],
			foreignColumns: [sales.id],
			name: 'surplus_units_consumed_by_sale_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.reservedForSaleId],
			foreignColumns: [sales.id],
			name: 'surplus_units_reserved_for_sale_id_fkey'
		}).onDelete('set null')
	]
);

// Type exports
export type SurplusUnit = typeof surplusUnits.$inferSelect;
export type NewSurplusUnit = typeof surplusUnits.$inferInsert;
