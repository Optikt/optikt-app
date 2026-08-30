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

import { brands } from './brands';
import { suppliers } from './suppliers';
import { materials } from './materials';

export const products = pgTable(
	'products',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		sku: varchar().notNull(),
		name: varchar().notNull(),
		type: varchar().notNull(),
		brandId: uuid('brand_id'),
		supplierId: uuid('supplier_id').notNull(),
		color: varchar(),
		size: varchar(),
		gender: varchar({ length: 20 }),
		materialId: uuid('material_id').notNull(),
		description: varchar(),
		// Physical attributes — Frames & Sunglasses
		/** Lens width in mm (calibre) */
		lensWidth: integer('lens_width'),
		/** Bridge width in mm (puente) */
		bridgeWidth: integer('bridge_width'),
		/** Temple arm length in mm (varilla) */
		templeLength: integer('temple_length'),
		// Physical attributes — Contact Lenses
		/** Base curve (BC) value */
		baseCurve: doublePrecision('base_curve'),
		/** Lens diameter in mm */
		diameter: doublePrecision('diameter'),
		/** Cached: purchase price from the most recent lot */
		currentPurchasePrice: doublePrecision('current_purchase_price'),
		/** Cached: sale price from the most recent lot */
		currentSalePrice: doublePrecision('current_sale_price'),
		/** Manufacturer/brand code printed on the product (e.g. on temples) */
		personalCode: varchar('personal_code'),
		/** Whether this product's SKU was auto-generated from its attributes */
		isAutoSku: boolean('is_auto_sku').notNull().default(false),
		/** Whether this product is subject to tax (IVA) */
		isTaxable: boolean('is_taxable').notNull().default(true),
		/** Cached counter: SUM(inventory_lots.quantityAvailable) */
		stock: integer().notNull().default(0),
		minStock: integer('min_stock'),
		imageUrl: varchar('image_url'),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_products_brand_id').using('btree', table.brandId.asc().nullsLast().op('uuid_ops')),
		index('ix_products_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_products_name').using('btree', table.name.asc().nullsLast().op('text_ops')),
		uniqueIndex('ix_products_sku').using('btree', table.sku.asc().nullsLast().op('text_ops')),
		index('ix_products_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_products_type').using('btree', table.type.asc().nullsLast().op('text_ops')),
		index('ix_products_material_id').using(
			'btree',
			table.materialId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.brandId],
			foreignColumns: [brands.id],
			name: 'products_brand_id_fkey'
		}).onDelete('set null'),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'products_supplier_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: 'products_material_id_fkey'
		}).onDelete('restrict')
	]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
