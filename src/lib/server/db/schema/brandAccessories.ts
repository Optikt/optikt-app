import {
	pgTable,
	serial,
	uuid,
	doublePrecision,
	boolean,
	timestamp,
	varchar,
	index,
	uniqueIndex,
	foreignKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { brands } from './brands';
import { products } from './products';
import { users } from './users';

export const brandAccessories = pgTable(
	'brand_accessories',
	{
		id: serial('id').primaryKey(),
		brandId: uuid('brand_id').notNull(),
		productId: uuid('product_id'),
		// Null is reserved for a product-level disabled override marker.
		accessoryProductId: uuid('accessory_product_id'),
		priceMode: varchar('price_mode', { length: 20 }).notNull().default('COURTESY'),
		customPrice: doublePrecision('custom_price'),
		isActive: boolean('is_active').notNull().default(true),
		createdById: uuid('created_by_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_brand_accessories_id').using('btree', table.id.asc().nullsLast().op('int4_ops')),
		index('ix_brand_accessories_brand_id').using(
			'btree',
			table.brandId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_brand_accessories_product_id').using(
			'btree',
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_brand_accessories_accessory_product_id').using(
			'btree',
			table.accessoryProductId.asc().nullsLast().op('uuid_ops')
		),
		uniqueIndex('ux_brand_accessories_brand_level')
			.using(
				'btree',
				table.brandId.asc().nullsLast().op('uuid_ops'),
				table.accessoryProductId.asc().nullsLast().op('uuid_ops')
			)
			.where(sql`${table.productId} IS NULL`),
		uniqueIndex('ux_brand_accessories_product_override')
			.using(
				'btree',
				table.brandId.asc().nullsLast().op('uuid_ops'),
				table.productId.asc().nullsLast().op('uuid_ops'),
				table.accessoryProductId.asc().nullsLast().op('uuid_ops')
			)
			.where(sql`${table.productId} IS NOT NULL`),
		uniqueIndex('ux_brand_accessories_product_disabled_override')
			.using(
				'btree',
				table.brandId.asc().nullsLast().op('uuid_ops'),
				table.productId.asc().nullsLast().op('uuid_ops')
			)
			.where(sql`${table.productId} IS NOT NULL AND ${table.accessoryProductId} IS NULL`),
		foreignKey({
			columns: [table.brandId],
			foreignColumns: [brands.id],
			name: 'brand_accessories_brand_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'brand_accessories_product_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.accessoryProductId],
			foreignColumns: [products.id],
			name: 'brand_accessories_accessory_product_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: 'brand_accessories_created_by_id_fkey'
		}).onDelete('restrict')
	]
);

export type BrandAccessory = typeof brandAccessories.$inferSelect;
export type NewBrandAccessory = typeof brandAccessories.$inferInsert;
