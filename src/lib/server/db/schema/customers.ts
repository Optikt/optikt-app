import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	date,
	json
} from 'drizzle-orm/pg-core';

export const customers = pgTable(
	'customers',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		firstName: varchar('first_name').notNull(),
		lastName: varchar('last_name').notNull(),
		idNumber: varchar('id_number'),
		birthDate: date('birth_date', { mode: 'date' }),
		primaryPhone: varchar('primary_phone').notNull(),
		email: varchar(),
		address: varchar(),
		secondaryPhones: json('secondary_phones').$type<string[]>(),
		notes: varchar(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_customers_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_customers_id_number').using(
			'btree',
			table.idNumber.asc().nullsLast().op('text_ops')
		),
		index('ix_customers_primary_phone').using(
			'btree',
			table.primaryPhone.asc().nullsLast().op('text_ops')
		)
	]
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
