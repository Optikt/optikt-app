import {
	pgTable,
	varchar,
	index,
	uuid,
	timestamp,
	integer,
	doublePrecision,
	foreignKey,
	boolean,
	json
} from 'drizzle-orm/pg-core';
import { customers } from './customers';

/**
 * Treatments stored on a prescription
 * All fields are optional booleans except 'other' which requires a description
 */
export type PrescriptionTreatments = {
	antiReflective: boolean;
	blueBlock: boolean;
	photochromic: boolean;
	other: string | null;
};

export const prescriptions = pgTable(
	'prescriptions',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		customerId: uuid('customer_id').notNull(),
		prescriptionDate: timestamp('prescription_date', {
			withTimezone: true,
			mode: 'string'
		}).notNull(),
		// Right eye (OD)
		odSphere: doublePrecision('od_sphere'),
		odCylinder: doublePrecision('od_cylinder'),
		odAxis: integer('od_axis'),
		odAddition: doublePrecision('od_addition'),
		odAltura: doublePrecision('od_altura'),
		// Left eye (OS)
		osSphere: doublePrecision('os_sphere'),
		osCylinder: doublePrecision('os_cylinder'),
		osAxis: integer('os_axis'),
		osAddition: doublePrecision('os_addition'),
		osAltura: doublePrecision('os_altura'),
		// Distancia Pupilar (DP) - total pupillary distance
		dp: doublePrecision(),
		// Nasopupilar (NP) - per-eye measurements
		npRight: doublePrecision('np_right'),
		npLeft: doublePrecision('np_left'),
		// Treatments
		treatments: json('treatments').$type<PrescriptionTreatments>(),
		// Additional
		recommendedLensType: varchar('recommended_lens_type'),
		notes: varchar(),
		doctorName: varchar('doctor_name'),
		// Current prescription flag
		isCurrent: boolean('is_current').notNull().default(false),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_prescriptions_customer_id').using(
			'btree',
			table.customerId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_prescriptions_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_prescriptions_prescription_date').using(
			'btree',
			table.prescriptionDate.asc().nullsLast()
		),
		foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: 'prescriptions_customer_id_fkey'
		}).onDelete('cascade')
	]
);

export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;
