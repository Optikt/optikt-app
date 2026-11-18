import type { Quote, QuoteItem, QuoteItemFreeDetails } from '$lib/server/db/schema';

export type { Quote, QuoteItem, QuoteItemFreeDetails };

/** Quote con relaciones para listado y detalle (mismos campos que ventas). */
export type QuoteWithRelations = Quote & {
	/** Card de cliente del hero (mismos campos que ventas). */
	customer: {
		id: string;
		firstName: string;
		lastName: string;
		idNumber: string | null;
		birthDate: string | null;
		primaryPhone: string | null;
		gender: string | null;
		address: string | null;
	} | null;
	seller: { id: string; fullName: string } | null;
	/** Número de la venta generada (para "Venta #0298" en la lista y el detalle). */
	convertedOrderNumber: number | null;
};

export type QuoteItemWithDetails = QuoteItem & {
	product: { id: string; name: string; sku: string } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
	supplierTreatment: { id: string; name: string; category: string } | null;
	freeDetails: QuoteItemFreeDetails | null;
};

/** KPIs del listado (globales, como ventas). Fórmulas en `docs/agents/quotes.md`. */
export interface QuoteStats {
	total: number;
	open: number;
	openTotal: number;
	monthly: number;
	monthlyTotal: number;
	monthlyConverted: number;
	draft: number;
	converted: number;
	cancelled: number;
}

export type QuoteOrderBy = 'quoteDate' | 'quoteNumber' | 'total' | 'createdAt' | 'validUntil';

export interface QuoteFilterOptions {
	includeDeleted?: boolean;
	status?: string;
	/** Multi-select de pestañas (empty/undefined = sin filtro), igual que ventas. */
	statuses?: string[];
	customerId?: string;
	sellerId?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
	isCashea?: boolean;
}

export interface GetQuotesOptions extends QuoteFilterOptions {
	orderBy?: QuoteOrderBy;
	orderSort?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}
