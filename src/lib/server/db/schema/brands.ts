import { pgTable, varchar, index, uniqueIndex, uuid, timestamp } from 'drizzle-orm/pg-core';

export const brands = pgTable(
	'brands',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		name: varchar().notNull(),
		description: varchar(),
		country: varchar(),
		logoUrl: varchar('logo_url'),
		website: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_brands_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_brands_name').using('btree', table.name.asc().nullsLast().op('text_ops'))
	]
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
