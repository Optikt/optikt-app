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
		purchasePrice: doublePrecision('purchase_price').notNull(),
		salePrice: doublePrecision('sale_price').notNull(),
		stock: integer(),
		minStock: integer('min_stock'),
		imageUrl: varchar('image_url'),
		isActive: boolean('is_active').notNull().default(true),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
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
