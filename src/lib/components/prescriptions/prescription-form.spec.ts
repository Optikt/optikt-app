import { describe, expect, it } from 'vitest';
import { prescriptionToFormData } from './prescription-form';
import type { Prescription } from '$lib/server/db/schema';

describe('prescriptionToFormData', () => {
	it('preserves the calendar date from a UTC date-only value', () => {
		const prescription = {
			id: 'prescription-1',
			customerId: 'customer-1',
			prescriptionDate: new Date(Date.UTC(2026, 3, 8, 0, 0, 0, 0)),
			odSphere: -3,
			odCylinder: 0,
			odAxis: 180,
			odAddition: null,
			osSphere: -3,
			osCylinder: 0,
			osAxis: 170,
			osAddition: null,
			dp: null,
			npRight: null,
			npLeft: null,
			altura: null,
			treatments: null,
			recommendedLensType: 'MONOFOCAL',
			notes: null,
			doctorName: 'Dr. Propia',
			isCurrent: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null
		} as Prescription;

		const formData = prescriptionToFormData(prescription);

		expect(formData.prescriptionDate).toBe('2026-04-08');
	});
});
