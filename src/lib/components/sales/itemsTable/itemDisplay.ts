import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import {
	SaleItemType,
	FREE_ITEM_CATEGORY_LABELS,
	type FreeItemCategory
} from '$lib/shared/enums/lensTypes';
import type { DocumentItemKind } from '$lib/components/commercialDocument/itemView';
import { getCachedLensItem } from '../catalogCache.svelte';

export interface DisplayGroup {
	key: string;
	item: SaleItemWithDetails;
	quantity: number;
	discountAmount: number;
	lineTotal: number;
	treatments: SaleItemWithDetails[];
}

/** Display name for a persisted sale item (single source for list + calculator). */
export function itemName(item: SaleItemWithDetails): string {
	if (item.itemType === SaleItemType.FREE_ITEM) {
		return item.freeDetails?.description ?? 'Ítem libre';
	}
	return item.snapshotName ?? item.product?.name ?? item.lensCatalogItem?.name ?? 'Item sin nombre';
}

export function itemLabel(group: DisplayGroup): string {
	return itemName(group.item);
}

/** Neutral kind for the icon chip (no colored type tags — structure is greyscale). */
export function itemKind(itemType: string): DocumentItemKind {
	if (itemType === SaleItemType.LENS_PAIR) return 'crystal';
	if (itemType === SaleItemType.FREE_ITEM) return 'free';
	return 'product';
}

export function itemKindTooltip(kind: DocumentItemKind): string {
	switch (kind) {
		case 'crystal':
			return 'Cristal';
		case 'free':
			return 'Ítem libre';
		default:
			return 'Montura / producto';
	}
}

/** Factory treatments included in the lens (from the shared catalog cache, same as the drawer). */
export function factoryTreatments(lensCatalogItemId: string | null): string[] {
	if (!lensCatalogItemId) return [];
	const lens = getCachedLensItem(lensCatalogItemId);
	if (!lens) return [];
	const parts: string[] = [];
	if (lens.hasAr) parts.push('Antirreflejo');
	if (lens.hasBluecut) parts.push('Blue Block');
	if (lens.isPhotochromic) parts.push('Fotocromático');
	return parts;
}

/**
 * Secondary meta line (single source: drawer parity).
 * product → `SKU · brand` · lens → `lab · Incluye …` · free → `categoría · descripción`.
 */
export function itemSubtitle(group: DisplayGroup): string | undefined {
	const item = group.item;
	if (item.itemType === SaleItemType.LENS_PAIR) {
		const factory = factoryTreatments(item.lensCatalogItemId ?? null);
		const parts = [item.snapshotBrand];
		if (factory.length > 0) parts.push(`Incluye ${factory.join(', ')}`);
		return parts.filter(Boolean).join(' · ') || undefined;
	}
	if (item.itemType === SaleItemType.FREE_ITEM) {
		const category = item.freeDetails?.category
			? (FREE_ITEM_CATEGORY_LABELS[item.freeDetails.category as FreeItemCategory] ?? null)
			: null;
		const parts = [category, item.freeDetails?.description].filter(Boolean);
		return parts.length > 0 ? parts.join(' · ') : 'Servicio';
	}
	return (
		[item.snapshotSku ?? item.product?.sku, item.snapshotBrand].filter(Boolean).join(' · ') ||
		undefined
	);
}

/** Progressive/bifocal lenses need mounting measures (ALT/DNP) in the expanded table. */
export function isProgressiveItem(item: SaleItemWithDetails): boolean {
	const type = item.lensCatalogItem?.type;
	if (type === 'PROGRESSIVE' || type === 'BIFOCAL') return true;
	const name = item.snapshotName ?? '';
	return /Progresivo|Bifocal/i.test(name);
}

/**
 * Mounting measures missing for assembly (optional data — absent renders "—").
 * Progressive/bifocal lenses need ALT + naso-pupilar per eye; DP is not required.
 */
export function missingMountingMeasures(item: SaleItemWithDetails): boolean {
	return (
		item.odAltura == null || item.osAltura == null || item.npRight == null || item.npLeft == null
	);
}
