import { describe, expect, it } from 'vitest';
import { SaleStatus } from '$lib/shared/enums';
import {
	SALE_PAID_EPSILON,
	isSaleCancelled,
	saleBalance,
	saleHasBalance,
	saleIsPaid,
	salePaymentPercent
} from './saleBalance';

const base = { total: 180, paidAmountBcvUsd: 0, status: SaleStatus.PENDING };

describe('saleBalance', () => {
	it('sin abono devuelve el total completo', () => {
		expect(saleBalance(base)).toBe(180);
	});

	it('abono parcial devuelve la diferencia', () => {
		expect(saleBalance({ ...base, paidAmountBcvUsd: 75 })).toBe(105);
	});

	it('nunca devuelve saldo negativo (sobrepago)', () => {
		expect(saleBalance({ ...base, total: 100, paidAmountBcvUsd: 130 })).toBe(0);
	});

	it('en canceladas el saldo no aplica aunque quede deuda', () => {
		expect(saleBalance({ total: 180, paidAmountBcvUsd: 0, status: SaleStatus.CANCELLED })).toBe(0);
	});

	it('tolera ruido de punto flotante sin salirse de 0', () => {
		expect(saleBalance({ total: 0.1, paidAmountBcvUsd: 0.3, status: SaleStatus.PENDING })).toBe(0);
	});
});

describe('saleHasBalance / saleIsPaid', () => {
	it('venta sin abono tiene saldo', () => {
		expect(saleHasBalance(base)).toBe(true);
		expect(saleIsPaid(base)).toBe(false);
	});

	it('venta pagada exacta no tiene saldo', () => {
		const paid = { total: 180, paidAmountBcvUsd: 180, status: SaleStatus.COMPLETED };
		expect(saleHasBalance(paid)).toBe(false);
		expect(saleIsPaid(paid)).toBe(true);
	});

	it('la tolerancia 0.01 cuenta como pagada', () => {
		const almost = {
			total: 180,
			paidAmountBcvUsd: 180 - SALE_PAID_EPSILON,
			status: SaleStatus.READY
		};
		expect(saleHasBalance(almost)).toBe(false);
		expect(saleIsPaid(almost)).toBe(true);
	});

	it('un centavo por encima de la tolerancia sigue con saldo', () => {
		const owed = {
			total: 180,
			paidAmountBcvUsd: 180 - SALE_PAID_EPSILON - 0.001,
			status: SaleStatus.READY
		};
		expect(saleHasBalance(owed)).toBe(true);
		expect(saleIsPaid(owed)).toBe(false);
	});

	it('en canceladas no hay saldo ni estado pagado', () => {
		const cancelled = { total: 180, paidAmountBcvUsd: 0, status: SaleStatus.CANCELLED };
		expect(saleHasBalance(cancelled)).toBe(false);
		expect(saleIsPaid(cancelled)).toBe(false);
		expect(isSaleCancelled(cancelled)).toBe(true);
	});
});

describe('salePaymentPercent', () => {
	it('redondea al entero y topea en 100', () => {
		expect(
			salePaymentPercent({ total: 180, paidAmountBcvUsd: 90, status: SaleStatus.PENDING })
		).toBe(50);
		expect(
			salePaymentPercent({ total: 180, paidAmountBcvUsd: 400, status: SaleStatus.PENDING })
		).toBe(100);
	});

	it('sin abono es 0%, total 0 sin cancelar es 100%', () => {
		expect(salePaymentPercent(base)).toBe(0);
		expect(salePaymentPercent({ total: 0, paidAmountBcvUsd: 0, status: SaleStatus.PENDING })).toBe(
			100
		);
	});

	it('en canceladas es 0 (no hay progreso que mostrar)', () => {
		expect(
			salePaymentPercent({ total: 180, paidAmountBcvUsd: 180, status: SaleStatus.CANCELLED })
		).toBe(0);
	});
});
