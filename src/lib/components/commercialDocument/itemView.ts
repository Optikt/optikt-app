import { computeDiscount, formatPrice } from '$lib/utils';
import { DiscountType } from '$lib/shared/enums';

/**
 * Domain-agnostic view model for a commercial-document item row.
 * Sale and quote adapters map their own items onto this shapes so the
 * presentational components stay reusable.
 */

/** Kind of item: drives the neutral icon chip (no colored type badges). */
export type DocumentItemKind = 'crystal' | 'product' | 'free' | 'treatment';

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
	/** Single meta line (SKU · brand, category · description, lab + «Incluye …»). */
	subtitle?: string;
	/**-Untruncated line per eye (OD / OI) — the prescription the optician verifies. */
	subtitleLines?: string[];
	kind: DocumentItemKind;
	quantity: number;
	unitPrice: number;
	discount?: number;
	discountType?: string;
	badges?: DocumentItemBadge[];
	isNew?: boolean;
	/** Removed-state: row stays, dimmed and struck through, restorable. */
	removed?: boolean;
}

export interface DocumentChildView {
	/** Stable key for the keyed each. */
	key: string;
	title: string;
	kind: DocumentItemKind;
	/** Secondary tag, e.g. «ANTIRREFLEJO» / «ADICIONAL». */
	tag: string;
	/** Count of prescription-ready eyes (or generic quantity). */
	quantity: number;
	unitPrice: number;
	/** Unit price text (e.g. "USD 30 c/u"). */
	unitPriceLabel: string;
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

/** Untruncated per-eye row line: "OD −2.25 −0.50 ×90" / "OI sin receta". */
export function rxRowLine(
	label: 'OD' | 'OI',
	disabled: boolean,
	eye: {
		sphere?: number | null;
		cylinder?: number | null;
		axis?: number | null;
		addition?: number | null;
	}
): string {
	if (disabled) return `${label} sin receta`;
	return eyeSummary(label, eye);
}
