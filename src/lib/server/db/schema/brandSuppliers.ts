import { pgTable, uuid, timestamp, index, foreignKey, primaryKey } from 'drizzle-orm/pg-core';

import { brands } from './brands';
import { suppliers } from './suppliers';

export const brandSuppliers = pgTable(
	'brand_suppliers',
	{
		brandId: uuid('brand_id').notNull(),
		supplierId: uuid('supplier_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		primaryKey({
			columns: [table.brandId, table.supplierId],
			name: 'brand_suppliers_pkey'
		}),
		index('ix_brand_suppliers_brand_id').using(
			'btree',
			table.brandId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_brand_suppliers_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.brandId],
			foreignColumns: [brands.id],
			name: 'brand_suppliers_brand_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'brand_suppliers_supplier_id_fkey'
		}).onDelete('cascade')
	]
);

export type BrandSupplier = typeof brandSuppliers.$inferSelect;
export type NewBrandSupplier = typeof brandSuppliers.$inferInsert;
