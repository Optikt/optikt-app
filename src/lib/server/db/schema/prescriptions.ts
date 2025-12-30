import {
	pgTable,
	varchar,
	index,
	uuid,
	timestamp,
	date,
	integer,
	doublePrecision,
	foreignKey
} from 'drizzle-orm/pg-core';
import { customers } from './customers';

export const prescriptions = pgTable(
	'prescriptions',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		customerId: uuid('customer_id').notNull(),
		prescriptionDate: date('prescription_date', { mode: 'date' }).notNull(),
		// Right eye (OD)
		odSphere: doublePrecision('od_sphere'),
		odCylinder: doublePrecision('od_cylinder'),
		odAxis: integer('od_axis'),
		odAddition: doublePrecision('od_addition'),
		// Left eye (OS)
		osSphere: doublePrecision('os_sphere'),
		osCylinder: doublePrecision('os_cylinder'),
		osAxis: integer('os_axis'),
		osAddition: doublePrecision('os_addition'),
		// PD
		pd: doublePrecision(),
		pdRight: doublePrecision('pd_right'),
		pdLeft: doublePrecision('pd_left'),
		// Additional
		recommendedLensType: varchar('recommended_lens_type'),
		notes: varchar(),
		doctorName: varchar('doctor_name'),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_prescriptions_customer_id').using(
			'btree',
			table.customerId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_prescriptions_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_prescriptions_prescription_date').using(
			'btree',
			table.prescriptionDate.asc().nullsLast().op('date_ops')
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
