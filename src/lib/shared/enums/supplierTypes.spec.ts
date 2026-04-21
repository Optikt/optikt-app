import { describe, it, expect } from 'vitest';
import {
	SupplierType,
	ALL_SUPPLIER_TYPES,
	SUPPLIER_TYPE_LABELS,
	getSupplierTypeLabel,
	supplierTypeColors,
	getSupplierTypeBadgeColor
} from './supplierTypes';

describe('SupplierType enum', () => {
	it('has all expected values', () => {
		expect(SupplierType.DISTRIBUTOR).toBe('DISTRIBUTOR');
		expect(SupplierType.LABORATORY).toBe('LABORATORY');
		expect(SupplierType.BOTH).toBe('BOTH');
	});

	it('ALL_SUPPLIER_TYPES contains all values', () => {
		expect(ALL_SUPPLIER_TYPES).toHaveLength(3);
		expect(ALL_SUPPLIER_TYPES).toContain(SupplierType.DISTRIBUTOR);
		expect(ALL_SUPPLIER_TYPES).toContain(SupplierType.LABORATORY);
		expect(ALL_SUPPLIER_TYPES).toContain(SupplierType.BOTH);
	});
});

describe('getSupplierTypeLabel', () => {
	it('returns Spanish labels for known types', () => {
		expect(getSupplierTypeLabel('DISTRIBUTOR')).toBe('Distribuidor');
		expect(getSupplierTypeLabel('LABORATORY')).toBe('Laboratorio');
		expect(getSupplierTypeLabel('BOTH')).toBe('Ambos');
	});

	it('has a label for every supplier type', () => {
		for (const type of ALL_SUPPLIER_TYPES) {
			expect(SUPPLIER_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns raw value for unknown type', () => {
		expect(getSupplierTypeLabel('UNKNOWN')).toBe('UNKNOWN');
	});

	it('returns raw value for empty string', () => {
		expect(getSupplierTypeLabel('')).toBe('');
	});
});

describe('getSupplierTypeBadgeColor', () => {
	it('returns correct badge colors', () => {
		expect(getSupplierTypeBadgeColor('DISTRIBUTOR')).toBe('info');
		expect(getSupplierTypeBadgeColor('LABORATORY')).toBe('success');
		expect(getSupplierTypeBadgeColor('BOTH')).toBe('purple');
	});

	it('has a color for every supplier type', () => {
		for (const type of ALL_SUPPLIER_TYPES) {
			expect(supplierTypeColors[type]).toBeDefined();
		}
	});

	it('returns info (default) for unknown type', () => {
		expect(getSupplierTypeBadgeColor('INVALID')).toBe('info');
	});
});
