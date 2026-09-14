import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

export interface DisplayGroup {
	key: string;
	item: SaleItemWithDetails;
	quantity: number;
	discountAmount: number;
	lineTotal: number;
	treatments: SaleItemWithDetails[];
}

export function itemLabel(group: DisplayGroup): string {
	if (group.item.itemType === SaleItemType.FREE_ITEM) {
		return group.item.freeDetails?.description ?? 'Ítem libre';
	}
	return (
		group.item.snapshotName ??
		group.item.product?.name ??
		group.item.lensCatalogItem?.name ??
		'Item sin nombre'
	);
}

export function splitItemName(group: DisplayGroup): { principal: string; details: string } {
	const name = itemLabel(group);
	const parts = name.split('·').map((s) => s.trim());
	if (parts.length > 1) {
		return { principal: parts[0], details: parts.slice(1).join(' · ') };
	}
	const sku = group.item.snapshotSku ?? group.item.product?.sku;
	if (sku) {
		return { principal: name, details: sku };
	}
	return { principal: name, details: '' };
}

export function itemBadge(itemType: string): { label: string; classes: string } {
	if (itemType === SaleItemType.LENS_PAIR) {
		return {
			label: 'CRISTAL',
			classes: 'text-amber-700 bg-amber-100 border-amber-200'
		};
	}
	if (itemType === SaleItemType.FREE_ITEM) {
		return {
			label: 'ÍTEM LIBRE',
			classes: 'text-gray-600 bg-gray-100 border-gray-200'
		};
	}
	return {
		label: 'MONTURA',
		classes: 'text-indigo-700 bg-indigo-50 border-indigo-100'
	};
}

export function iconContainerClasses(itemType: string): string {
	if (itemType === SaleItemType.LENS_PAIR) {
		return 'bg-amber-100 border-amber-200 text-amber-700';
	}
	if (itemType === SaleItemType.FREE_ITEM) {
		return 'bg-gray-100 border-gray-200 text-gray-500';
	}
	return 'bg-indigo-50 border-indigo-100 text-indigo-600';
}

export function rowHoverClasses(itemType: string): string {
	if (itemType === SaleItemType.LENS_PAIR) return 'hover:bg-amber-50/30';
	return 'hover:bg-gray-50/50';
}

export function prescriptionValue(val: number | null | undefined): string {
	return val != null ? String(val) : '—';
}
