import { pgTable, varchar, uuid, timestamp, doublePrecision, integer } from 'drizzle-orm/pg-core';

/**
 * Business Settings Table
 * Singleton row containing business configuration
 */
export const settings = pgTable('settings', {
	id: uuid().primaryKey().notNull().defaultRandom(),
	businessName: varchar('business_name'),
	businessRif: varchar('business_rif'),
	businessPhone: varchar('business_phone'),
	businessEmail: varchar('business_email'),
	businessAddress: varchar('business_address'),
	businessWebsite: varchar('business_website'),
	businessLogo: varchar('business_logo'),
	defaultTaxRate: doublePrecision('default_tax_rate').notNull().default(16),
	// ── Conteo físico (ciclo de cobertura, umbral de diferencia, atajos) ──
	/** Plazo del ciclo de conteo: cada ítem debería contarse dentro de este plazo en días */
	countCycleDays: integer('count_cycle_days').notNull().default(30),
	/** Umbral de diferencia en unidades: >=overe umbral exige recuento antes de cerrar */
	countDiffThresholdUnits: integer('count_diff_threshold_units').notNull().default(2),
	/** Umbral de diferencia en USD (0 = desactivado). Se activa si |dif × costo| ≥ valor */
	countDiffThresholdUsd: doublePrecision('count_diff_threshold_usd').notNull().default(0),
	/** N por defecto del atajo «los más atrasados» */
	countQuickOldestLimit: integer('count_quick_oldest_limit').notNull().default(50),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
