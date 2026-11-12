/**
 * Saldo pendiente de venta — helper puro compartido.
 *
 * Lo usan la lista, la vista de cuadros, los KPIs y el resumen de selección
 * del listado de ventas (plan `sales-list-redesign`), y es el candidato a
 * reemplazar los cálculos inline del detalle (`sales/[id]`) y de receivables.
 *
 * Reglas de dominio (`docs/agents/sales.md`):
 * - "Cobrado" sale SIEMPRE de `paidAmountBcvUsd` (suma recalculada de pagos activos).
 * - Tolerancia `SALE_PAID_EPSILON` (0.01) para considerar una venta pagada.
 * - En `CANCELLED` el saldo no aplica.
 */
import { SaleStatus } from '$lib/shared/enums';

/** Tolerancia de dominio para "¿pagada?" (nunca comparar con === 0). */
export const SALE_PAID_EPSILON = 0.01;

/** Lo mínimo que necesita cualquier cálculo de saldo. */
export interface SaleBalanceSource {
	total: number;
	paidAmountBcvUsd: number;
	status: string;
}

export function isSaleCancelled(sale: SaleBalanceSource): boolean {
	return sale.status === SaleStatus.CANCELLED;
}

/**
 * Saldo pendiente en USD.
 * Canceladas: 0 (no aplica). Nunca negativo (un sobrepago no genera saldo negativo).
 */
export function saleBalance(sale: SaleBalanceSource): number {
	if (isSaleCancelled(sale)) return 0;
	return Math.max(0, sale.total - sale.paidAmountBcvUsd);
}

/** ¿Queda saldo por cobrar (> 0.01)? Canceladas: false. */
export function saleHasBalance(sale: SaleBalanceSource): boolean {
	return saleBalance(sale) > SALE_PAID_EPSILON;
}

/** ¿Venta pagada (saldo dentro de la tolerancia)? Canceladas: false (no aplica). */
export function saleIsPaid(sale: SaleBalanceSource): boolean {
	return !isSaleCancelled(sale) && saleBalance(sale) <= SALE_PAID_EPSILON;
}

/**
 * Porcentaje cobrado 0–100 (redondeado, tope 100).
 * Canceladas: 0. Total <= 0 sin cancelar: 100.
 */
export function salePaymentPercent(sale: SaleBalanceSource): number {
	if (isSaleCancelled(sale)) return 0;
	if (sale.total <= 0) return 100;
	return Math.min(100, Math.max(0, Math.round((sale.paidAmountBcvUsd / sale.total) * 100)));
}
