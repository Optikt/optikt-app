import { describe, expect, it } from 'vitest';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import { FreeItemCategory, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import { cacheLensItem } from '../catalogCache.svelte';
import {
	factoryTreatments,
	isProgressiveItem,
	itemKind,
	itemKindTooltip,
	itemLabel,
	itemName,
	itemSubtitle,
	type DisplayGroup
} from './itemDisplay';

function item(overrides: Record<string, unknown>): SaleItemWithDetails {
	return {
		itemType: SaleItemType.PRODUCT,
		quantity: 1,
		...overrides
	} as unknown as SaleItemWithDetails;
}

function group(overrides: Partial<DisplayGroup>): DisplayGroup {
	return {
		key: 'g1',
		item: item({}),
		quantity: 1,
		discountAmount: 0,
		lineTotal: 10,
		treatments: [],
		...overrides
	};
}

describe('itemName', () => {
	it('uses the free-item description when present', () => {
		expect(
			itemName(
				item({
					itemType: SaleItemType.FREE_ITEM,
					freeDetails: { description: 'Ajuste de montura' } as never
				})
			)
		).toBe('Ajuste de montura');
	});

	it('falls back to "Ítem libre" for unnamed free items', () => {
		expect(itemName(item({ itemType: SaleItemType.FREE_ITEM }))).toBe('Ítem libre');
	});

	it('prefers snapshotName, then product, then lens catalog, then a placeholder', () => {
		expect(itemName(item({ snapshotName: 'Snapshot', product: { name: 'Producto' } }))).toBe(
			'Snapshot'
		);
		expect(itemName(item({ product: { name: 'Producto' } }))).toBe('Producto');
		expect(itemName(item({ lensCatalogItem: { name: 'Cristal RX' } }))).toBe('Cristal RX');
		expect(itemName(item({}))).toBe('Item sin nombre');
	});
});

describe('itemLabel', () => {
	it('mirrors the item display name', () => {
		expect(itemLabel(group({ item: item({ snapshotName: 'Montura X' }) }))).toBe('Montura X');
	});
});

describe('itemKind / itemKindTooltip', () => {
	it('maps item types to neutral icon kinds', () => {
		expect(itemKind(SaleItemType.LENS_PAIR)).toBe('crystal');
		expect(itemKind(SaleItemType.FREE_ITEM)).toBe('free');
		expect(itemKind(SaleItemType.PRODUCT)).toBe('product');
		expect(itemKind(SaleItemType.TREATMENT)).toBe('product');
	});

	it('labels each kind for the tooltip', () => {
		expect(itemKindTooltip('crystal')).toBe('Cristal');
		expect(itemKindTooltip('free')).toBe('Ítem libre');
		expect(itemKindTooltip('product')).toBe('Montura / producto');
	});
});

describe('factoryTreatments', () => {
	it('returns nothing without a lens catalog id or cache entry', () => {
		expect(factoryTreatments(null)).toEqual([]);
		expect(factoryTreatments('missing-lens')).toEqual([]);
	});

	it('lists the factory treatments flagged on the cached lens', () => {
		cacheLensItem({
			id: 'lens-1',
			hasAr: true,
			hasBluecut: true,
			isPhotochromic: false
		} as unknown as LensCatalogItemWithRelations);
		expect(factoryTreatments('lens-1')).toEqual(['Antirreflejo', 'Blue Block']);
	});
});

describe('itemSubtitle', () => {
	it('describes lens pairs with brand and factory treatments', () => {
		cacheLensItem({
			id: 'lens-sub',
			hasAr: true,
			hasBluecut: false,
			isPhotochromic: false
		} as unknown as LensCatalogItemWithRelations);
		const lens = item({
			itemType: SaleItemType.LENS_PAIR,
			snapshotBrand: 'Essilor',
			lensCatalogItemId: 'lens-sub'
		});
		expect(itemSubtitle(group({ item: lens }))).toBe('Essilor · Incluye Antirreflejo');
		expect(
			itemSubtitle(
				group({ item: item({ itemType: SaleItemType.LENS_PAIR, snapshotBrand: 'Essilor' }) })
			)
		).toBe('Essilor');
		expect(
			itemSubtitle(group({ item: item({ itemType: SaleItemType.LENS_PAIR }) }))
		).toBeUndefined();
	});

	it('describes free items with category and description', () => {
		const free = item({
			itemType: SaleItemType.FREE_ITEM,
			freeDetails: { category: FreeItemCategory.SERVICE, description: 'Ajuste' } as never
		});
		expect(itemSubtitle(group({ item: free }))).toBe('Servicio · Ajuste');
		expect(itemSubtitle(group({ item: item({ itemType: SaleItemType.FREE_ITEM }) }))).toBe(
			'Servicio'
		);
	});

	it('describes products with SKU and brand', () => {
		expect(
			itemSubtitle(group({ item: item({ snapshotSku: 'SKU-1', snapshotBrand: 'RayBan' }) }))
		).toBe('SKU-1 · RayBan');
		expect(itemSubtitle(group({ item: item({}) }))).toBeUndefined();
	});
});

describe('isProgressiveItem', () => {
	it('detects progressive/bifocal lenses by catalog type', () => {
		expect(isProgressiveItem(item({ lensCatalogItem: { type: 'PROGRESSIVE' } }))).toBe(true);
		expect(isProgressiveItem(item({ lensCatalogItem: { type: 'BIFOCAL' } }))).toBe(true);
		expect(isProgressiveItem(item({ lensCatalogItem: { type: 'SINGLE_VISION' } }))).toBe(false);
	});

	it('falls back to the snapshot name', () => {
		expect(isProgressiveItem(item({ snapshotName: 'Cristal Progresivo 1.60' }))).toBe(true);
		expect(isProgressiveItem(item({ snapshotName: 'Cristal Bifocal' }))).toBe(true);
		expect(isProgressiveItem(item({ snapshotName: 'Monofocal' }))).toBe(false);
	});
});
