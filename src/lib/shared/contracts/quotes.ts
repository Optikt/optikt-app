/**
 * Quote (Presupuesto) contracts
 * Status workflow, labels, and badge colors
 */

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

export const quoteStatusColors: Record<QuoteStatus, 'yellow' | 'blue' | 'gray' | 'red'> = {
	[QuoteStatus.DRAFT]: 'yellow',
	[QuoteStatus.CONVERTED]: 'blue',
	[QuoteStatus.EXPIRED]: 'gray',
	[QuoteStatus.CANCELLED]: 'red'
};

export type QuoteStatusColor = (typeof quoteStatusColors)[QuoteStatus];

export function getQuoteStatusBadgeColor(status: string): QuoteStatusColor {
	return quoteStatusColors[status as QuoteStatus] ?? 'yellow';
}
