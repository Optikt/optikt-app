/**
 * Shared helpers for sale wizard components (Step 2, Step 3, NewSaleForm).
 * Pure functions that operate on SaleItemRow + data arrays.
 */

import { DiscountType } from '$lib/shared/enums';
import type { CompatibilityVerdict } from '$lib/shared/matching/types';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { SaleItemRow } from './newSaleTypes';

// ============================================================================
// ITEM LOOKUPS
// ============================================================================

export function findProduct(
	item: SaleItemRow,
	products: ProductWithRelations[]
): ProductWithRelations | undefined {
	if (item.kind === 'product' && item.productId) {
		return products.find((p) => p.id === item.productId);
	}
	return undefined;
}

export function findLensItem(
	item: SaleItemRow,
	lensItems: LensCatalogItemWithRelations[]
): LensCatalogItemWithRelations | undefined {
	if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) return undefined;
	return lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
}

export function getItemName(
	item: SaleItemRow,
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): string {
	if (item.kind === 'product') {
		return findProduct(item, products)?.name ?? '—';
	}
	return findLensItem(item, lensItems)?.name ?? '—';
}

// ============================================================================
// PRICING
// ============================================================================

export function computeItemDiscount(item: SaleItemRow): number {
	const qty = item.kind === 'product' ? item.quantity : 1;
	const lineTotal = item.unitPrice * qty;
	if (item.discountType === DiscountType.PERCENTAGE) {
		return (item.discount / 100) * lineTotal;
	}
	return item.discount;
}

export function itemLineTotal(item: SaleItemRow): number {
	const qty = item.kind === 'product' ? item.quantity : 1;
	return item.unitPrice * qty - computeItemDiscount(item);
}

// ============================================================================
// COMPATIBILITY VERDICT
// ============================================================================

/** Get the worst compatibility verdict across both eyes of a lens item */
export function getItemVerdict(item: SaleItemRow): CompatibilityVerdict | null {
	if (item.kind !== 'lens' || !item.lensPair) return null;
	const { od, oi } = item.lensPair;
	if (od.enabled && od.compatibilityVerdict === 'SIGNATURE_MISMATCH') return 'SIGNATURE_MISMATCH';
	if (oi.enabled && oi.compatibilityVerdict === 'SIGNATURE_MISMATCH') return 'SIGNATURE_MISMATCH';
	if (od.enabled && od.compatibilityVerdict === 'CONSULT_REQUIRED') return 'CONSULT_REQUIRED';
	if (oi.enabled && oi.compatibilityVerdict === 'CONSULT_REQUIRED') return 'CONSULT_REQUIRED';
	if (
		(od.enabled && od.compatibilityVerdict === 'EXACT_MATCH') ||
		(oi.enabled && oi.compatibilityVerdict === 'EXACT_MATCH')
	)
		return 'EXACT_MATCH';
	return null;
}

// ============================================================================
// VERDICT DISPLAY CONFIG
// ============================================================================

export interface VerdictDisplayConfig {
	label: string;
	shortLabel: string;
	borderColor: string;
	bgColor: string;
	badgeBgColor: string;
	textColor: string;
	desc: string;
}

export const VERDICT_DISPLAY: Record<CompatibilityVerdict, VerdictDisplayConfig> = {
	EXACT_MATCH: {
		label: 'Compatible',
		shortLabel: 'Compatible',
		borderColor: 'border-emerald-300',
		bgColor: 'bg-emerald-50',
		badgeBgColor: 'bg-emerald-100',
		textColor: 'text-emerald-700',
		desc: 'La fórmula del paciente está dentro del rango de este lente.'
	},
	CONSULT_REQUIRED: {
		label: 'Consultar Proveedor',
		shortLabel: 'Consultar',
		borderColor: 'border-amber-300',
		bgColor: 'bg-amber-50',
		badgeBgColor: 'bg-amber-100',
		textColor: 'text-amber-700',
		desc: 'El proveedor debe confirmar disponibilidad para esta fórmula.'
	},
	SIGNATURE_MISMATCH: {
		label: 'Incompatible',
		shortLabel: 'Incompatible',
		borderColor: 'border-red-300',
		bgColor: 'bg-red-50',
		badgeBgColor: 'bg-red-100',
		textColor: 'text-red-700',
		desc: 'La fórmula del paciente no es compatible con este lente.'
	}
};
