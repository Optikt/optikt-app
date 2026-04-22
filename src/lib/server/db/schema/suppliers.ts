import {
	pgTable,
	pgEnum,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	json,
	boolean,
	doublePrecision,
	unique,
	foreignKey
} from 'drizzle-orm/pg-core';
import { enumValues } from './utils';
import { TreatmentCategory } from '../../../shared/enums/lensTypes';

// ============================================================================
// SUPPLIERS
// ============================================================================

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
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_suppliers_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_suppliers_name').using('btree', table.name.asc().nullsLast().op('text_ops')),
		uniqueIndex('ix_suppliers_rif').using('btree', table.rif.asc().nullsLast().op('text_ops'))
	]
);

// ============================================================================
// SUPPLIER TREATMENTS - optional extras a lab offers for tallado lenses
// ============================================================================

export const treatmentCategoryEnum = pgEnum('treatment_category', enumValues(TreatmentCategory));

export const supplierTreatments = pgTable(
	'supplier_treatments',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		supplierId: uuid('supplier_id').notNull(),
		name: varchar().notNull(),
		category: treatmentCategoryEnum().notNull(),
		price: doublePrecision().notNull(),
		/** Sale price (what the customer pays). Nullable - fallback to cost price if not set */
		salePrice: doublePrecision('sale_price'),
		/** Whether this treatment is subject to tax (IVA) */
		isTaxable: boolean('is_taxable').notNull().default(true),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_supplier_treatments_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_supplier_treatments_supplier_id').using(
			'btree',
			table.supplierId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: 'supplier_treatments_supplier_id_fkey'
		}).onDelete('cascade'),
		unique('uq_supplier_treatment_name').on(table.supplierId, table.name)
	]
);

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type SupplierTreatment = typeof supplierTreatments.$inferSelect;
export type NewSupplierTreatment = typeof supplierTreatments.$inferInsert;
