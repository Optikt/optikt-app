import { describe, it, expect } from 'vitest';
import { resolveTreatmentPolicies } from './resolveTreatmentPolicies';
import { LensTreatmentAvailability } from '$lib/shared/contracts/lenses';
import type { LensTreatmentPolicy } from '$lib/shared/contracts/lenses';

const NOT_AVAILABLE = LensTreatmentAvailability.NOT_AVAILABLE;
const OPTIONAL_EXTRA = LensTreatmentAvailability.OPTIONAL_EXTRA;
const INHERENT = LensTreatmentAvailability.INHERENT;

function findByCode(policies: LensTreatmentPolicy[], code: string) {
	return policies.find((p) => p.code === code)!;
}

describe('resolveTreatmentPolicies', () => {
	it('returns NOT_AVAILABLE defaults when both inputs are empty', () => {
		const result = resolveTreatmentPolicies([], []);
		expect(result).toHaveLength(2);
		const ar = findByCode(result, 'AR');
		const bc = findByCode(result, 'BLUECUT');
		expect(ar.availability).toBe(NOT_AVAILABLE);
		expect(ar.additionalPrice).toBe(0);
		expect(ar.requiresConfirmation).toBe(false);
		expect(bc.availability).toBe(NOT_AVAILABLE);
	});

	it('uses supplier defaults when no item overrides', () => {
		const supplierDefaults: LensTreatmentPolicy[] = [
			{ code: 'AR', availability: OPTIONAL_EXTRA, additionalPrice: 50, requiresConfirmation: false },
			{ code: 'BLUECUT', availability: INHERENT, additionalPrice: 0, requiresConfirmation: false }
		];
		const result = resolveTreatmentPolicies(supplierDefaults, []);
		const ar = findByCode(result, 'AR');
		expect(ar.availability).toBe(OPTIONAL_EXTRA);
		expect(ar.additionalPrice).toBe(50);
		const bc = findByCode(result, 'BLUECUT');
		expect(bc.availability).toBe(INHERENT);
	});

	it('item overrides one code, supplier used for the other', () => {
		const supplierDefaults: LensTreatmentPolicy[] = [
			{ code: 'AR', availability: OPTIONAL_EXTRA, additionalPrice: 50, requiresConfirmation: false },
			{ code: 'BLUECUT', availability: NOT_AVAILABLE, additionalPrice: 0, requiresConfirmation: false }
		];
		const itemOverrides: LensTreatmentPolicy[] = [
			{ code: 'AR', availability: INHERENT, additionalPrice: 0, requiresConfirmation: false }
		];
		const result = resolveTreatmentPolicies(supplierDefaults, itemOverrides);
		expect(findByCode(result, 'AR').availability).toBe(INHERENT);
		expect(findByCode(result, 'AR').additionalPrice).toBe(0);
		expect(findByCode(result, 'BLUECUT').availability).toBe(NOT_AVAILABLE);
	});

	it('item overrides all codes — ignores supplier entirely', () => {
		const supplierDefaults: LensTreatmentPolicy[] = [
			{ code: 'AR', availability: NOT_AVAILABLE, additionalPrice: 0, requiresConfirmation: false },
			{ code: 'BLUECUT', availability: NOT_AVAILABLE, additionalPrice: 0, requiresConfirmation: false }
		];
		const itemOverrides: LensTreatmentPolicy[] = [
			{ code: 'AR', availability: OPTIONAL_EXTRA, additionalPrice: 100, requiresConfirmation: true },
			{ code: 'BLUECUT', availability: INHERENT, additionalPrice: 0, requiresConfirmation: false }
		];
		const result = resolveTreatmentPolicies(supplierDefaults, itemOverrides);
		const ar = findByCode(result, 'AR');
		expect(ar.availability).toBe(OPTIONAL_EXTRA);
		expect(ar.additionalPrice).toBe(100);
		expect(ar.requiresConfirmation).toBe(true);
		expect(findByCode(result, 'BLUECUT').availability).toBe(INHERENT);
	});

	it('missing supplier defaults falls back to NOT_AVAILABLE', () => {
		const itemOverrides: LensTreatmentPolicy[] = [
			{ code: 'BLUECUT', availability: OPTIONAL_EXTRA, additionalPrice: 30, requiresConfirmation: false }
		];
		const result = resolveTreatmentPolicies([], itemOverrides);
		expect(findByCode(result, 'AR').availability).toBe(NOT_AVAILABLE);
		expect(findByCode(result, 'BLUECUT').availability).toBe(OPTIONAL_EXTRA);
		expect(findByCode(result, 'BLUECUT').additionalPrice).toBe(30);
	});

	it('always returns exactly one entry per core treatment code', () => {
		const result = resolveTreatmentPolicies(
			[{ code: 'AR', availability: OPTIONAL_EXTRA, additionalPrice: 10, requiresConfirmation: false }],
			[{ code: 'AR', availability: INHERENT, additionalPrice: 0, requiresConfirmation: false }]
		);
		expect(result).toHaveLength(2);
		const codes = result.map((p) => p.code).sort();
		expect(codes).toEqual(['AR', 'BLUECUT']);
	});
});
