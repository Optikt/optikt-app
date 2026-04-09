import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	boolean
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { UserRole } from '../../../shared/enums';

export const users = pgTable(
	'users',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		email: varchar().notNull(),
		username: varchar().notNull(),
		fullName: varchar('full_name').notNull(),
		hashedPassword: varchar('hashed_password').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		isSuperuser: boolean('is_superuser').notNull().default(false),
		role: varchar().notNull().default(UserRole.VIEWER).$type<UserRole>(),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('ix_users_email').using('btree', table.email.asc().nullsLast().op('text_ops')),
		index('ix_users_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_users_username').using('btree', table.username.asc().nullsLast().op('text_ops')),
		uniqueIndex('ix_users_username_lower').using('btree', sql`lower((username)::text)`)
	]
);

type DrizzleUser = typeof users.$inferSelect;
export type User = Omit<DrizzleUser, 'role'> & { role: UserRole };
export type NewUser = typeof users.$inferInsert;
