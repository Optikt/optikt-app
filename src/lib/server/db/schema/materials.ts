import { pgTable, varchar, index, uniqueIndex, uuid, timestamp } from 'drizzle-orm/pg-core';

/**
 * Unified Materials Table
 *
 * This table stores materials used across different product types:
 * - Frame materials: Titanium, Acetate, TR90, Metal, etc. (also used by sunglasses)
 * - Contact lens materials: Silicone Hydrogel, etc.
 * - Accessory materials: Leather, Microfiber, etc.
 *
 * The `productType` field indicates which product type this material applies to.
 * Note: SUNGLASSES materials are stored as FRAME type (they share materials).
 * Note: Lens materials (CR39, Polycarbonate, etc.) have a dedicated `lens_materials` table.
 */

export const materials = pgTable(
	'materials',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		name: varchar().notNull(),
		code: varchar().notNull(),
		productType: varchar('product_type', { length: 20 }).notNull(), // FRAME, CONTACT_LENS, ACCESSORY
		description: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
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
		uniqueIndex('ix_materials_code_product_type').using(
			'btree',
			table.code.asc().nullsLast().op('text_ops'),
			table.productType.asc().nullsLast().op('text_ops')
		)
	]
);

export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
