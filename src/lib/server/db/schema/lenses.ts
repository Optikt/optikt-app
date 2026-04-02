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
import { enumValues } from './utils';
import {
	LensCatalogSource,
	LensPriceType,
	LensInventoryMode
} from '../../../shared/enums/lensTypes';

// ============================================================================
// LENS ENUMS — derived from shared enums (single source of truth)
// ============================================================================

export const lensCatalogSourceEnum = pgEnum('lens_catalog_source', enumValues(LensCatalogSource));
export const lensPriceTypeEnum = pgEnum('lens_price_type', enumValues(LensPriceType));
export const lensInventoryModeEnum = pgEnum('lens_inventory_mode', enumValues(LensInventoryMode));

// ============================================================================
// LENS MATERIALS (unchanged)
// ============================================================================

export const lensMaterials = pgTable(
	'lens_materials',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		name: varchar().notNull(),
		code: varchar().notNull(),
		refractiveIndex: doublePrecision('refractive_index'),
		description: varchar(),
		isActive: boolean('is_active').notNull().default(true),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('ix_lens_materials_code').using(
			'btree',
			table.code.asc().nullsLast().op('text_ops')
		),
		index('ix_lens_materials_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_lens_materials_name').using(
			'btree',
			table.name.asc().nullsLast().op('text_ops')
		)
	]
);

// ============================================================================
// LENS CATALOG ITEMS (simplified)
// ============================================================================

export const lensCatalogItems = pgTable(
	'lens_catalog_items',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		source: lensCatalogSourceEnum().notNull().default('LAB'),
		supplierId: uuid('supplier_id').notNull(),
		name: varchar().notNull(),
		type: varchar().notNull(),
		technology: varchar(),
		materialId: uuid('material_id').notNull(),

		// --- Inherent traits (booleans) ---
		hasAr: boolean('has_ar').notNull().default(false),
		hasBluecut: boolean('has_bluecut').notNull().default(false),
		isPhotochromic: boolean('is_photochromic').notNull().default(false),

		// --- Pricing ---
		priceType: lensPriceTypeEnum('price_type').notNull().default('UNIT'),
		basePrice: doublePrecision('base_price').notNull(),
		salePrice: doublePrecision('sale_price'),
		mountingPrice: doublePrecision('mounting_price').notNull().default(0),
		shippingPrice: doublePrecision('shipping_price').notNull().default(0),

		// --- Tax ---
		/** Whether this lens is subject to tax (IVA). Lenses are exempt by default. */
		isTaxable: boolean('is_taxable').notNull().default(false),
		/** Tax rate percentage (e.g. 16 for 16%) */
		taxRate: doublePrecision('tax_rate').notNull().default(16),

		// --- Inventory ---
		inventoryMode: lensInventoryModeEnum('inventory_mode').notNull().default('ON_DEMAND'),
		stock: integer(),
		notes: varchar(),
		isActive: boolean('is_active').notNull().default(true),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_lens_catalog_items_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_lens_catalog_items_material_id').using(
			'btree',
			table.materialId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_lens_catalog_items_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.materialId],
			foreignColumns: [lensMaterials.id],
			name: 'lens_catalog_items_material_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'lens_catalog_items_supplier_id_fkey'
		}).onDelete('cascade')
	]
);

// ============================================================================
// LENS OPTICAL RANGES (simplified — removed mirrorGroup)
// ============================================================================

export const lensOpticalRanges = pgTable(
	'lens_optical_ranges',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		lensCatalogItemId: uuid('lens_catalog_item_id').notNull(),
		sphereMin: doublePrecision('sphere_min').notNull(),
		sphereMax: doublePrecision('sphere_max').notNull(),
		cylinderMin: doublePrecision('cylinder_min'),
		cylinderMax: doublePrecision('cylinder_max'),
		additionMin: doublePrecision('addition_min'),
		additionMax: doublePrecision('addition_max'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_lens_optical_ranges_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_lens_optical_ranges_item_id').using(
			'btree',
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'lens_optical_ranges_item_id_fkey'
		}).onDelete('cascade')
	]
);

// Type exports
export type LensMaterial = typeof lensMaterials.$inferSelect;
export type NewLensMaterial = typeof lensMaterials.$inferInsert;
export type LensCatalogItem = typeof lensCatalogItems.$inferSelect;
export type NewLensCatalogItem = typeof lensCatalogItems.$inferInsert;
export type LensOpticalRange = typeof lensOpticalRanges.$inferSelect;
export type NewLensOpticalRange = typeof lensOpticalRanges.$inferInsert;
