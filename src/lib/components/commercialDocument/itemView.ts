import { computeDiscount, formatPrice } from '$lib/utils';
import { DiscountType } from '$lib/shared/enums';

/**
 * Domain-agnostic view model for a commercial-document item row.
 * Sale and quote adapters map their own items onto this shape so the
 * presentational components stay reusable.
 */

export type DocumentItemTone = 'crystal' | 'product' | 'free' | 'treatment';

export type DocumentBadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export interface DocumentItemBadge {
	label: string;
	tone?: DocumentBadgeTone;
	/** Extra context shown in an info tooltip next to the badge. */
	tooltip?: string;
}

export interface DocumentItemView {
	id: string;
	title: string;
	/** Short type tag shown in the meta line (CRISTAL, PRODUCTO, ÍTEM LIBRE). */
	typeLabel: string;
	subtitle?: string;
	tone: DocumentItemTone;
	quantity: number;
	unitPrice: number;
	discount?: number;
	discountType?: string;
	badges?: DocumentItemBadge[];
	isNew?: boolean;
}

export interface DocumentItemTotals {
	gross: number;
	discount: number;
	net: number;
}

export function itemTotals(
	item: Pick<DocumentItemView, 'unitPrice' | 'quantity' | 'discount' | 'discountType'>
): DocumentItemTotals {
	const gross = item.unitPrice * item.quantity;
	const discount = Math.min(
		gross,
		Math.max(0, computeDiscount(item.discount ?? 0, item.discountType ?? DiscountType.FIXED, gross))
	);
	return { gross, discount, net: Math.max(0, gross - discount) };
}

/** Chip label for an item discount: "−10%" or "−$7.50". */
export function discountChip(value: number, type?: string): string {
	return type === DiscountType.PERCENTAGE ? `−${value}%` : `−${formatPrice(value)}`;
}

function optical(value: number | null | undefined): string {
	if (value == null) return '';
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function eyeSummary(
	label: string,
	eye: {
		sphere?: number | null;
		cylinder?: number | null;
		axis?: number | null;
		addition?: number | null;
	}
): string {
	const parts = [optical(eye.sphere)];
	if (eye.cylinder != null) parts.push(optical(eye.cylinder));
	const base = parts.filter(Boolean).join(' ').trim();
	const axis = eye.axis != null ? ` ×${eye.axis}` : '';
	const add = eye.addition != null ? ` · Add ${optical(eye.addition)}` : '';
	return `${label} ${base || '—'}${axis}${add}`.replace(/\s+/g, ' ').trim();
}

/** "OD −2.25 −0.75 ×90 · OI −1.75 −0.50 ×85" */
export function formatRxSummary(rx: {
	od: {
		sphere?: number | null;
		cylinder?: number | null;
		axis?: number | null;
		addition?: number | null;
	};
	oi: {
		sphere?: number | null;
		cylinder?: number | null;
		axis?: number | null;
		addition?: number | null;
	};
}): string {
	return `${eyeSummary('OD', rx.od)} · ${eyeSummary('OI', rx.oi)}`;
}
