import { describe, expect, it } from 'vitest';
import { RefundStatus, SaleStatus } from '$lib/shared/enums';
import {
	bsEquivalent,
	customerIdNumber,
	customerInitials,
	customerName,
	customerPhone,
	nextStatusTargets,
	refundDecisionTitle,
	resolveSaleRateDisplay,
	saleStatusPillClasses,
	saleStatusLabel
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

describe('saleStatusPillClasses', () => {
	it('maps every status to its hero pill classes', () => {
		expect(saleStatusPillClasses(SaleStatus.PENDING)).toBe(
			'bg-warning-container text-on-warning-container'
		);
		expect(saleStatusPillClasses(SaleStatus.IN_PROGRESS)).toBe(
			'bg-info-container text-on-info-container'
		);
		expect(saleStatusPillClasses(SaleStatus.READY)).toBe(
			'bg-purple-container text-on-purple-container'
		);
		expect(saleStatusPillClasses(SaleStatus.COMPLETED)).toBe(
			'bg-success-container text-on-success-container'
		);
		expect(saleStatusPillClasses(SaleStatus.CANCELLED)).toBe(
			'bg-error-container text-on-error-container'
		);
		expect(saleStatusPillClasses('UNKNOWN')).toBe('bg-warning-container text-on-warning-container');
	});
});

describe('saleStatusLabel', () => {
	it('delegates to the shared enum label', () => {
		expect(saleStatusLabel(SaleStatus.PENDING)).toBe('Pendiente');
		expect(saleStatusLabel(SaleStatus.CANCELLED)).toBe('Cancelada');
	});
});

describe('resolveSaleRateDisplay', () => {
	it('prefers the snapshot rate without approximation', () => {
		expect(resolveSaleRateDisplay(886.23, 900)).toEqual({
			rate: 886.23,
			isSnapshot: true,
			approximate: false
		});
	});

	it('falls back to the live rate as referential', () => {
		expect(resolveSaleRateDisplay(null, 900)).toEqual({
			rate: 900,
			isSnapshot: false,
			approximate: true
		});
	});

	it('returns a null rate when neither source is available', () => {
		expect(resolveSaleRateDisplay(null, null)).toEqual({
			rate: null,
			isSnapshot: false,
			approximate: false
		});
	});
});

describe('bsEquivalent', () => {
	it('multiplies at the given rate', () => {
		expect(bsEquivalent(10, 40)).toBe(400);
	});

	it('returns null without a usable rate', () => {
		expect(bsEquivalent(10, null)).toBeNull();
		expect(bsEquivalent(10, 0)).toBeNull();
		expect(bsEquivalent(10, -5)).toBeNull();
	});
});

describe('customerInitials', () => {
	it('takes up to two letters from the name', () => {
		expect(customerInitials('Estefania Villarroel')).toBe('EV');
		expect(customerInitials('  maría  pérez  ')).toBe('MP');
		expect(customerInitials('Ana')).toBe('AN');
		expect(customerInitials('')).toBe('?');
	});
});
