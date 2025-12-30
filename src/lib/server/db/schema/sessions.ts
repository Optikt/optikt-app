import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	boolean,
	foreignKey
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const userSessions = pgTable(
	'user_sessions',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		userId: uuid('user_id').notNull(),
		tokenHash: varchar('token_hash', { length: 64 }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		isActive: boolean('is_active').notNull().default(true),
		ipAddress: varchar('ip_address', { length: 45 }),
		userAgent: varchar('user_agent', { length: 255 }),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_user_sessions_expires_at').using(
			'btree',
			table.expiresAt.asc().nullsLast().op('timestamptz_ops')
		),
		index('ix_user_sessions_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		uniqueIndex('ix_user_sessions_token_hash').using(
			'btree',
			table.tokenHash.asc().nullsLast().op('text_ops')
		),
		index('ix_user_sessions_user_id').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'user_sessions_user_id_fkey'
		}).onDelete('cascade')
	]
);

export type Session = typeof userSessions.$inferSelect;
export type NewSession = typeof userSessions.$inferInsert;
