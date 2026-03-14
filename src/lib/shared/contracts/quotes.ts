import { DiscountType } from '$lib/shared/enums';
import type { FulfillmentPlan } from './fulfillment';

export enum QuoteStatus {
	DRAFT = 'DRAFT',
	APPROVED = 'APPROVED',
	CONVERTED = 'CONVERTED',
	EXPIRED = 'EXPIRED',
	CANCELLED = 'CANCELLED'
}

export interface QuoteItemDraft {
	id: string;
	kind: 'product' | 'lens';
	productId: string | null;
	lensCatalogItemId: string | null;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: DiscountType;
	notes: string;
}

export interface QuoteDraft {
	id: string;
	quoteNumber: number;
	title: string;
	status: QuoteStatus;
	customerId: string | null;
	conversionSaleId: string | null;
	items: QuoteItemDraft[];
	planningSnapshot: FulfillmentPlan | null;
	notes: string | null;
	createdAtIso: string;
	updatedAtIso: string;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
	[QuoteStatus.DRAFT]: 'Borrador',
	[QuoteStatus.APPROVED]: 'Aprobado',
	[QuoteStatus.CONVERTED]: 'Convertido',
	[QuoteStatus.EXPIRED]: 'Expirado',
	[QuoteStatus.CANCELLED]: 'Cancelado'
};