import {
	pgTable,
	uuid,
	varchar,
	jsonb,
	timestamp,
	primaryKey,
	foreignKey
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Preferencias de usuario (clave/valor, una fila por preferencia).
 *
 * Existen para que crecer en preferencias NO requiera migración: agregar una
 * preferencia nueva es agregar una clave al enum de `src/lib/schemas/users.ts`,
 * no una columna. Ejemplo: `sales.view` (vista Lista/Cuadros del listado de ventas).
 *
 * Dominio: `users` (ver `docs/agents/users.md`).
 */
export type UserPreferenceValue =
	string | number | boolean | null | UserPreferenceValue[] | { [key: string]: UserPreferenceValue };

export const userPreferences = pgTable(
	'user_preferences',
	{
		userId: uuid('user_id').notNull(),
		key: varchar('key', { length: 64 }).notNull(),
		value: jsonb('value').$type<UserPreferenceValue>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.key], name: 'user_preferences_pkey' }),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'user_preferences_user_id_fkey'
		}).onDelete('cascade')
	]
);

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
