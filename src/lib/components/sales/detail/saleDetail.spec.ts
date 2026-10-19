import { describe, expect, it } from 'vitest';
import { RefundStatus, SaleStatus } from '$lib/shared/enums';
import {
	customerIdNumber,
	customerName,
	customerPhone,
	nextStatusTargets,
	refundCardClasses,
	refundDecisionTitle
} from './saleDetail';

describe('customer display', () => {
	it('names assigned customers and fallbacks', () => {
		expect(customerName({ customer: { firstName: 'Ana', lastName: 'Pérez' } })).toBe('Ana Pérez');
		expect(customerName({ customer: null })).toBe('Cliente no asignado');
		expect(customerName({})).toBe('Cliente no asignado');
		expect(customerIdNumber({ customer: { firstName: 'A', lastName: 'B', idNumber: 'V-1' } })).toBe(
			'V-1'
		);
		expect(customerIdNumber({ customer: null })).toBe('Documento no registrado');
	});

	it('shows the stored phone and a fallback', () => {
		expect(
			customerPhone({ customer: { firstName: 'A', lastName: 'B', primaryPhone: '0412-1234567' } })
		).toBe('0412-1234567');
		expect(customerPhone({ customer: { firstName: 'A', lastName: 'B', primaryPhone: '  ' } })).toBe(
			'Teléfono no registrado'
		);
		expect(customerPhone({ customer: null })).toBe('Teléfono no registrado');
		expect(customerPhone({})).toBe('Teléfono no registrado');
	});
});

describe('refund display', () => {
	it('classes by refund status', () => {
		expect(refundCardClasses(RefundStatus.REFUNDED)).toContain('bg-red-50');
		expect(refundCardClasses(RefundStatus.RETAINED)).toContain('bg-amber-50');
		expect(refundCardClasses(RefundStatus.NO_PAYMENT)).toContain('bg-gray-50');
		expect(refundCardClasses(null)).toContain('bg-gray-50');
	});

	it('titles by refund status', () => {
		expect(refundDecisionTitle(RefundStatus.REFUNDED)).toBe('Reembolso emitido');
		expect(refundDecisionTitle(RefundStatus.RETAINED)).toBe('Depósito retenido');
		expect(refundDecisionTitle(RefundStatus.NO_PAYMENT)).toBe('Sin pagos previos');
		expect(refundDecisionTitle(undefined)).toBe('Sin pagos previos');
	});
});

describe('nextStatusTargets', () => {
	it('offers forward presets per status', () => {
		expect(nextStatusTargets(SaleStatus.PENDING)).toEqual([
			SaleStatus.IN_PROGRESS,
			SaleStatus.READY,
			SaleStatus.COMPLETED
		]);
		expect(nextStatusTargets(SaleStatus.IN_PROGRESS)).toEqual([
			SaleStatus.READY,
			SaleStatus.COMPLETED
		]);
		expect(nextStatusTargets(SaleStatus.READY)).toEqual([SaleStatus.COMPLETED]);
		expect(nextStatusTargets(SaleStatus.COMPLETED)).toBeNull();
		expect(nextStatusTargets(SaleStatus.CANCELLED)).toBeNull();
	});
});
