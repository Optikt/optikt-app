import { describe, it, expect } from 'vitest';
import { AxisSchema, CreatePrescriptionSchema } from './prescriptions';

// =============================================================================
// Axis Schema
// =============================================================================

describe('AxisSchema', () => {
	it('converts empty string to undefined', () => {
		const result = AxisSchema.safeParse('');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeUndefined();
		}
	});

	it('converts null to undefined', () => {
		const result = AxisSchema.safeParse(null);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeUndefined();
		}
	});

	it('accepts undefined', () => {
		const result = AxisSchema.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeUndefined();
		}
	});

	it('accepts intentional 0 as valid axis value', () => {
		const result = AxisSchema.safeParse('0');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(0);
		}
	});

	it('accepts 0 as number', () => {
		const result = AxisSchema.safeParse(0);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(0);
		}
	});

	it('accepts valid axis values', () => {
		expect(AxisSchema.safeParse('90').success).toBe(true);
		expect(AxisSchema.safeParse('180').success).toBe(true);
		expect(AxisSchema.safeParse(45).success).toBe(true);
		expect(AxisSchema.safeParse(180).success).toBe(true);
	});

	it('rejects axis values outside valid range', () => {
		expect(AxisSchema.safeParse('-1').success).toBe(false);
		expect(AxisSchema.safeParse('181').success).toBe(false);
		expect(AxisSchema.safeParse(-1).success).toBe(false);
		expect(AxisSchema.safeParse(181).success).toBe(false);
	});

	it('rejects non-integer values', () => {
		expect(AxisSchema.safeParse('90.5').success).toBe(false);
		expect(AxisSchema.safeParse(90.5).success).toBe(false);
	});
});

// =============================================================================
// CreatePrescriptionSchema - requireAxisWhenCylinder validation
// =============================================================================

describe('CreatePrescriptionSchema - requireAxisWhenCylinder', () => {
	const validBaseData = {
		customerId: '123e4567-e89b-12d3-a456-426614174000',
		prescriptionDate: '2024-01-15',
		odSphere: -2.0,
		osSphere: -2.0
	};

	it('requires axis when cylinder is provided (right eye)', () => {
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odCylinder: -1.0,
			odAxis: '' // Empty string should trigger validation error
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const hasAxisError = result.error.issues.some(
				(issue) => issue.path.includes('odAxis') && issue.message.includes('eje')
			);
			expect(hasAxisError).toBe(true);
		}
	});

	it('requires axis when cylinder is provided (left eye)', () => {
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			osCylinder: -1.0,
			osAxis: '' // Empty string should trigger validation error
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const hasAxisError = result.error.issues.some(
				(issue) => issue.path.includes('osAxis') && issue.message.includes('eje')
			);
			expect(hasAxisError).toBe(true);
		}
	});

	it('accepts axis 0 when cylinder is provided', () => {
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odCylinder: -1.0,
			odAxis: '0' // Intentional 0 should be accepted
		});
		expect(result.success).toBe(true);
	});

	it('does not require axis when cylinder is 0 (normalized to null on save)', () => {
		// With Option B: 0 is normalized to null for storage, so no axis required
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odCylinder: '0', // Explicit 0 cylinder (will be normalized to null on save)
			odAxis: '' // No axis needed
		});
		expect(result.success).toBe(true);
	});

	it('does not require axis when cylinder is not provided (empty)', () => {
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odCylinder: '', // Empty string → undefined → no cylinder
			odAxis: '' // No axis needed when no cylinder
		});
		expect(result.success).toBe(true);
	});

	it('accepts explicit 0 in both sphere and cylinder (patient has good vision)', () => {
		// Explicit 0 means patient has good vision (no correction needed)
		// This is valid input, even though it will be normalized to null on save
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odSphere: '0', // Explicit 0 - patient has good vision
			odCylinder: '0', // Explicit 0 - no astigmatism
			osSphere: '0', // Explicit 0 - patient has good vision
			osCylinder: '0' // Explicit 0 - no astigmatism
		});
		expect(result.success).toBe(true);
	});

	it('accepts explicit 0 in sphere with non-zero cylinder', () => {
		// Sphere is 0 (normalized to null), but cylinder has a real value
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odSphere: '0', // Will be normalized to null
			odCylinder: '-1.0', // Real value
			odAxis: '90',
			osSphere: '0', // Will be normalized to null
			osCylinder: '-0.5', // Real value
			osAxis: '180'
		});
		expect(result.success).toBe(true);
	});

	it('rejects when both sphere and cylinder are empty (not provided)', () => {
		const result = CreatePrescriptionSchema.safeParse({
			...validBaseData,
			odSphere: '', // Empty → undefined
			odCylinder: '', // Empty → undefined
			osSphere: '', // Empty → undefined
			osCylinder: '' // Empty → undefined
		});
		expect(result.success).toBe(false);
	});
});
