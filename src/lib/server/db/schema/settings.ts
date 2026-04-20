import { pgTable, varchar, uuid, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

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
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow()
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
