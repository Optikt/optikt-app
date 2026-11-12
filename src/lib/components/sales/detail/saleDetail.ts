import { RefundStatus, SaleStatus, getSaleStatusLabel } from '$lib/shared/enums';
import { resolveTicketRate } from '$lib/shared/ticketRate';

export interface SaleCustomerLike {
	firstName: string;
	lastName: string;
	idNumber?: string | null;
	primaryPhone?: string | null;
}

export function customerName(sale: { customer?: SaleCustomerLike | null }): string {
	if (!sale.customer) return 'Cliente no asignado';
	return `${sale.customer.firstName} ${sale.customer.lastName}`;
}

export function customerIdNumber(sale: { customer?: SaleCustomerLike | null }): string {
	return sale.customer?.idNumber ?? 'Documento no registrado';
}

export function customerPhone(sale: { customer?: SaleCustomerLike | null }): string {
	return sale.customer?.primaryPhone?.trim() || 'Teléfono no registrado';
}

export function refundDecisionTitle(refundStatus: string | null | undefined): string {
	if (refundStatus === RefundStatus.REFUNDED) return 'Reembolso emitido';
	if (refundStatus === RefundStatus.RETAINED) return 'Depósito retenido';
	return 'Sin pagos previos';
}

/** Forward sale-status flow (stepper + menu gating). Shared by hero + actions. */
export const SALE_STATUS_FLOW = [
	SaleStatus.PENDING,
	SaleStatus.IN_PROGRESS,
	SaleStatus.READY,
	SaleStatus.COMPLETED
] as const;

export function nextStatusTargets(status: string): SaleStatus[] | null {
	if (status === SaleStatus.PENDING) {
		return [SaleStatus.IN_PROGRESS, SaleStatus.READY, SaleStatus.COMPLETED];
	}

	if (status === SaleStatus.IN_PROGRESS) {
		return [SaleStatus.READY, SaleStatus.COMPLETED];
	}

	if (status === SaleStatus.READY) {
		return [SaleStatus.COMPLETED];
	}

	return null;
}

/** Human description per target status — used by the status menu and SaleStatusModal. */
export const SALE_STATUS_DESCRIPTIONS: Partial<Record<SaleStatus, string>> = {
	[SaleStatus.IN_PROGRESS]: 'Se empezó a elaborar el pedido',
	[SaleStatus.READY]: 'Listo para que el cliente lo retire',
	[SaleStatus.COMPLETED]: 'Entregado al cliente'
};

/** Status pill classes for the navy hero (token-based, one pill per status). */
export function saleStatusPillClasses(status: string): string {
	switch (status) {
		case SaleStatus.PENDING:
			return 'bg-warning-container text-on-warning-container';
		case SaleStatus.IN_PROGRESS:
			return 'bg-info-container text-on-info-container';
		case SaleStatus.READY:
			return 'bg-purple-container text-on-purple-container';
		case SaleStatus.COMPLETED:
			return 'bg-success-container text-on-success-container';
		case SaleStatus.CANCELLED:
			return 'bg-error-container text-on-error-container';
		default:
			return 'bg-warning-container text-on-warning-container';
	}
}

export function saleStatusLabel(status: string): string {
	return getSaleStatusLabel(status);
}

/**
 * Effective BCV rate for the sale's Bs. display, with its provenance.
 *
 * - Snapshot wins (frozen at sale creation) → `isSnapshot: true`, never approximate.
 * - Pre-snapshot sales fall back to the live rate → `approximate: true`: the UI
 *   MUST mark those amounts as referential (≈), never as historical truth.
 * - `rate: null` only when neither exists (UI hides the Bs. column).
 */
export function resolveSaleRateDisplay(
	snapshotBcvRate: number | null | undefined,
	liveBcvRate: number | null | undefined
): { rate: number | null; isSnapshot: boolean; approximate: boolean } {
	const rate = resolveTicketRate(snapshotBcvRate, liveBcvRate);
	const isSnapshot = snapshotBcvRate != null && snapshotBcvRate > 0;
	return { rate, isSnapshot, approximate: rate !== null && !isSnapshot };
}

/** Raw Bs. equivalent of a USD amount at `rate` (format only at paint time). */
export function bsEquivalent(amountUsd: number, rate: number | null): number | null {
	if (rate === null || rate <= 0) return null;
	return amountUsd * rate;
}

/** Initials for the customer avatar (max 2 letters). */
export function customerInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return '?';
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
}
