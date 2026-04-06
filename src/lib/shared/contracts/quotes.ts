/**
 * Quote (Presupuesto) contracts
 * Status workflow, labels, and badge colors
 */

import type { BadgeVariant } from '$lib/shared/badge-variants';

export enum QuoteStatus {
	DRAFT = 'DRAFT',
	CONVERTED = 'CONVERTED',
	EXPIRED = 'EXPIRED',
	CANCELLED = 'CANCELLED'
}

export const ALL_QUOTE_STATUSES = Object.values(QuoteStatus) as QuoteStatus[];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
	[QuoteStatus.DRAFT]: 'Borrador',
	[QuoteStatus.CONVERTED]: 'Convertido',
	[QuoteStatus.EXPIRED]: 'Expirado',
	[QuoteStatus.CANCELLED]: 'Cancelado'
};

export function getQuoteStatusLabel(status: string): string {
	return QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status;
}

export const quoteStatusColors: Record<QuoteStatus, BadgeVariant> = {
	[QuoteStatus.DRAFT]: 'warning',
	[QuoteStatus.CONVERTED]: 'info',
	[QuoteStatus.EXPIRED]: 'neutral',
	[QuoteStatus.CANCELLED]: 'error'
};

export function getQuoteStatusBadgeColor(status: string): BadgeVariant {
	return quoteStatusColors[status as QuoteStatus] ?? 'warning';
}
