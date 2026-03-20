import { pgTable, varchar, uuid, timestamp, doublePrecision, boolean, unique } from 'drizzle-orm/pg-core';
import { suppliers } from './suppliers';

// ============================================================================
// SUPPLIER TREATMENT POLICIES — treatment defaults per supplier/lab
// ============================================================================

/**
 * Defines the default treatment policy for each treatment code at the supplier level.
 * Catalog items inherit these defaults unless they explicitly override per-item.
 *
 * Resolution: supplier defaults → item overrides → final LensTreatmentPolicy[]
 */
export const supplierTreatmentPolicies = pgTable(
	'supplier_treatment_policies',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		supplierId: uuid('supplier_id')
			.notNull()
			.references(() => suppliers.id, { onDelete: 'cascade' }),
		/** CoreLensTreatmentCode — e.g. 'AR', 'BLUECUT' */
		code: varchar().notNull(),
		/** LensTreatmentAvailability — 'INHERENT' | 'OPTIONAL_EXTRA' | 'NOT_AVAILABLE' */
		availability: varchar().notNull(),
		additionalPrice: doublePrecision('additional_price').notNull().default(0),
		requiresConfirmation: boolean('requires_confirmation').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [unique('uq_supplier_treatment_code').on(table.supplierId, table.code)]
);

export type SupplierTreatmentPolicy = typeof supplierTreatmentPolicies.$inferSelect;
export type NewSupplierTreatmentPolicy = typeof supplierTreatmentPolicies.$inferInsert;
