import {
	pgTable,
	pgEnum,
	varchar,
	index,
	uuid,
	timestamp,
	integer,
	doublePrecision,
	foreignKey
} from 'drizzle-orm/pg-core';
import { inventoryLots } from './inventoryLots';
import { products } from './products';
import { lensCatalogItems } from './lenses';
import { users } from './users';
import { enumValues } from './utils';
import { InventoryMovementType, MovementReferenceType } from '../../../shared/enums/inventoryTypes';

// ============================================================================
// INVENTORY MOVEMENT ENUMS
// ============================================================================

export const inventoryMovementTypeEnum = pgEnum(
	'inventory_movement_type',
	enumValues(InventoryMovementType)
);

export const movementReferenceTypeEnum = pgEnum(
	'movement_reference_type',
	enumValues(MovementReferenceType)
);

// ============================================================================
// INVENTORY MOVEMENTS — Immutable log of all stock changes
// ============================================================================

/**
 * THIS TABLE IS IMMUTABLE.
 * No updatedAt, no deletedAt.
 * Records are never modified or deleted.
 * Corrections create new counter-movements.
 */
export const inventoryMovements = pgTable(
	'inventory_movements',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		movementType: inventoryMovementTypeEnum('movement_type').notNull(),
		lotId: uuid('lot_id').notNull(),
		/** 'PRODUCT' | 'LENS' (denormalized for queries) */
		itemType: varchar('item_type').notNull(),
		/** Denormalized FK for direct product queries */
		productId: uuid('product_id'),
		/** Denormalized FK for direct lens queries */
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		/** Positive = inflow, negative = outflow */
		quantityDelta: integer('quantity_delta').notNull(),
		/** Lot quantity BEFORE this movement */
		quantityBefore: integer('quantity_before').notNull(),
		/** Lot quantity AFTER this movement */
		quantityAfter: integer('quantity_after').notNull(),
		/** Type of the source document */
		referenceType: movementReferenceTypeEnum('reference_type').notNull(),
		/** ID of the source document */
		referenceId: uuid('reference_id').notNull(),
		/** Reason / notes (required for ADJUSTMENT_* types) */
		notes: varchar(),
		/** Cost per unit at time of adjustment (from lot.unitPurchasePrice). NULL for ADJUSTMENT_IN */
		unitCostAtAdjustment: doublePrecision('unit_cost_at_adjustment'),
		/** Total cost = unitCostAtAdjustment × quantity. NULL for ADJUSTMENT_IN */
		totalCostAtAdjustment: doublePrecision('total_cost_at_adjustment'),
		/** Report category for profit reports. NULL for ADJUSTMENT_IN */
		adjustmentReportCategory: varchar('adjustment_report_category'),
		createdById: uuid('created_by_id').notNull(),
		/** NEVER edited — immutable timestamp */
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_inventory_movements_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_inventory_movements_lot_id').using(
			'btree',
			table.lotId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_movements_product_id').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_movements_lens_id').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_movements_type').using('btree', table.movementType.asc().nullsLast()),
		index('ix_inventory_movements_reference').using(
			'btree',
			table.referenceType.asc().nullsLast(),
			table.referenceId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_movements_created_at').using(
			'btree',
			table.createdAt.asc().nullsLast().op('timestamptz_ops')
		),
		foreignKey({
			columns: [table.lotId],
			foreignColumns: [inventoryLots.id],
			name: 'inventory_movements_lot_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'inventory_movements_product_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'inventory_movements_lens_catalog_item_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: 'inventory_movements_created_by_id_fkey'
		}).onDelete('restrict')
	]
);

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
