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
	foreignKey,
	json,
	unique
} from 'drizzle-orm/pg-core';
import { suppliers } from './suppliers';

// ============================================================================
// LENS MATERIALS
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
// LENS TREATMENTS
// ============================================================================

export const lensTreatments = pgTable(
	'lens_treatments',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		name: varchar().notNull(),
		code: varchar().notNull(),
		description: varchar(),
		isActive: boolean('is_active').notNull().default(true),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('ix_lens_treatments_code').using(
			'btree',
			table.code.asc().nullsLast().op('text_ops')
		),
		index('ix_lens_treatments_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_lens_treatments_name').using(
			'btree',
			table.name.asc().nullsLast().op('text_ops')
		)
	]
);

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

export const lensCatalogItems = pgTable(
	'lens_catalog_items',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		supplierId: uuid('supplier_id').notNull(),
		name: varchar().notNull(),
		brand: varchar(),
		type: varchar().notNull(),
		materialId: uuid('material_id').notNull(),
		sphereMin: doublePrecision('sphere_min').notNull(),
		sphereMax: doublePrecision('sphere_max').notNull(),
		cylinderMin: doublePrecision('cylinder_min'),
		cylinderMax: doublePrecision('cylinder_max'),
		additionMin: doublePrecision('addition_min'),
		additionMax: doublePrecision('addition_max'),
		baseFeatures: json('base_features').$type<string[]>(),
		isPhotochromic: boolean('is_photochromic').notNull().default(false),
		basePrice: doublePrecision('base_price').notNull(),
		deliveryDays: integer('delivery_days'),
		stock: integer(),
		refractiveIndex: doublePrecision('refractive_index'),
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
// SUPPLIER LENS TREATMENTS (Junction Table)
// ============================================================================

export const supplierLensTreatments = pgTable(
	'supplier_lens_treatments',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		supplierId: uuid('supplier_id').notNull(),
		treatmentId: uuid('treatment_id').notNull(),
		price: doublePrecision().notNull(),
		isAvailable: boolean('is_available').notNull().default(true),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_supplier_lens_treatments_id').using(
			'btree',
			table.id.asc().nullsLast().op('uuid_ops')
		),
		index('ix_supplier_lens_treatments_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_supplier_lens_treatments_treatment_id').using(
			'btree',
			table.treatmentId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'supplier_lens_treatments_supplier_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.treatmentId],
			foreignColumns: [lensTreatments.id],
			name: 'supplier_lens_treatments_treatment_id_fkey'
		}).onDelete('cascade'),
		unique('uq_supplier_treatment').on(table.supplierId, table.treatmentId)
	]
);

// Type exports
export type LensMaterial = typeof lensMaterials.$inferSelect;
export type NewLensMaterial = typeof lensMaterials.$inferInsert;
export type LensTreatment = typeof lensTreatments.$inferSelect;
export type NewLensTreatment = typeof lensTreatments.$inferInsert;
export type LensCatalogItem = typeof lensCatalogItems.$inferSelect;
export type NewLensCatalogItem = typeof lensCatalogItems.$inferInsert;
export type SupplierLensTreatment = typeof supplierLensTreatments.$inferSelect;
export type NewSupplierLensTreatment = typeof supplierLensTreatments.$inferInsert;
