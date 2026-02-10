import { pgTable, varchar, index, uniqueIndex, uuid, timestamp, json } from 'drizzle-orm/pg-core';

export const suppliers = pgTable(
	'suppliers',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		name: varchar().notNull(),
		/** Type: DISTRIBUTOR, LABORATORY, BOTH */
		type: varchar().notNull(),
		/** RIF format: V/E/J/G-12345678-9 */
		rif: varchar(),
		primaryPhone: varchar('primary_phone').notNull(),
		email: varchar(),
		address: varchar(),
		secondaryPhones: json('secondary_phones').$type<string[]>(),
		instagram: varchar(),
		whatsapp: varchar(),
		website: varchar(),
		/** Single contact person (expandable to multiple later) */
		contactName: varchar('contact_name'),
		contactPhone: varchar('contact_phone'),
		contactRole: varchar('contact_role'),
		notes: varchar(),
		/** Default currency this supplier uses (CurrencyCode enum) */
		defaultCurrency: varchar('default_currency'),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_suppliers_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_suppliers_name').using('btree', table.name.asc().nullsLast().op('text_ops')),
		uniqueIndex('ix_suppliers_rif').using('btree', table.rif.asc().nullsLast().op('text_ops'))
	]
);

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
