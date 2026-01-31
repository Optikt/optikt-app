import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	boolean,
	doublePrecision
} from 'drizzle-orm/pg-core';

/**
 * Unified Materials Table
 *
 * This table stores all materials used across different product types:
 * - Frame materials: Titanium, Acetate, TR90, Metal, etc.
 * - Lens materials: CR39, Policarbonato, Trivex, etc.
 * - Accessory materials: Leather, Microfiber, etc.
 *
 * The `productType` field indicates which product type(s) this material applies to.
 * Use 'ALL' for materials that can be used across all product types.
 * Note: SUNGLASSES materials are stored as FRAME type (they share materials).
 */

export const materials = pgTable(
	'materials',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		name: varchar().notNull(),
		code: varchar().notNull(),
		productType: varchar('product_type', { length: 20 }).notNull(), // FRAME, LENS, CONTACT_LENS, ACCESSORY, ALL
		refractiveIndex: doublePrecision('refractive_index'), // Optional, mainly for lens materials
		description: varchar(),
		isActive: boolean('is_active').notNull().default(true),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_materials_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_materials_product_type').using(
			'btree',
			table.productType.asc().nullsLast().op('text_ops')
		),
		// Unique constraint: name + productType combination must be unique
		uniqueIndex('ix_materials_name_product_type').using(
			'btree',
			table.name.asc().nullsLast().op('text_ops'),
			table.productType.asc().nullsLast().op('text_ops')
		),
		uniqueIndex('ix_materials_code').using('btree', table.code.asc().nullsLast().op('text_ops'))
	]
);

export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
