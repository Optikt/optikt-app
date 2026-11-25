import { describe, expect, it } from 'vitest';

import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
import { ProductType } from '$lib/shared/enums/productTypes';
import { mapAccessorySummary, mapResolvedAccessory, type BrandAccessoryJoinRow } from './internal';

function makeJoinRow(overrides: Partial<BrandAccessoryJoinRow> = {}): BrandAccessoryJoinRow {
	return {
		rule: {
			id: 1,
			brandId: 'brand-1',
			productId: null,
			accessoryProductId: 'acc-1',
			priceMode: BrandAccessoryPriceMode.COURTESY,
			customPrice: null,
			isActive: true,
			createdById: 'user-1',
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z'
		},
		product: {
			id: 'acc-1',
			sku: 'EST-RB-01',
			name: 'Estuche Ray-Ban rígido',
			type: ProductType.ACCESSORY,
			brandId: 'brand-1',
			supplierId: 'sup-1',
			color: 'Negro',
			size: null,
			gender: null,
			materialId: 'mat-1',
			description: 'Estuche original con paño',
			lensWidth: null,
			bridgeWidth: null,
			templeLength: null,
			baseCurve: null,
			diameter: null,
			currentPurchasePrice: 2,
			currentSalePrice: 8,
			personalCode: null,
			isAutoSku: false,
			isTaxable: false,
			stock: 5,
			minStock: 1,
			imageUrl: null,
			deletedAt: null,
			lastCountedAt: null,
			lastCountSessionId: null,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-01-01T00:00:00Z'
		},
		brand: { id: 'brand-1', name: 'Ray-Ban' },
		supplier: { id: 'sup-1', name: 'Distribuidora Óptica' },
		material: { id: 'mat-1', name: 'Cuero sintético', code: 'CUE' },
		...overrides
	};
}

describe('brandAccessories row mappers', () => {
	it('mapResolvedAccessory returns full ProductWithRelations for catalog cache hydration', () => {
		const resolved = mapResolvedAccessory(makeJoinRow());

		expect(resolved).not.toBeNull();
		expect(resolved!.accessoryProductId).toBe('acc-1');
		expect(resolved!.currentProductPrice).toBe(8);
		expect(resolved!.accessory).toMatchObject({
			id: 'acc-1',
			name: 'Estuche Ray-Ban rígido',
			sku: 'EST-RB-01',
			type: ProductType.ACCESSORY,
			description: 'Estuche original con paño',
			isTaxable: false,
			stock: 5,
			brand: { id: 'brand-1', name: 'Ray-Ban' },
			supplier: { id: 'sup-1', name: 'Distribuidora Óptica' },
			material: { id: 'mat-1', name: 'Cuero sintético', code: 'CUE' }
		});
	});

	it('normalizes missing optional brand relation to null', () => {
		const resolved = mapResolvedAccessory(makeJoinRow({ brand: null }));
		expect(resolved?.accessory.brand).toBeNull();
	});

	it('returns null when product is absent (marker row or soft-deleted accessory)', () => {
		expect(mapResolvedAccessory(makeJoinRow({ product: null }))).toBeNull();
		expect(mapAccessorySummary(makeJoinRow({ product: null }))).toBeNull();
	});

	it('mapAccessorySummary preserves summary fields for admin brand/product views', () => {
		const summary = mapAccessorySummary(makeJoinRow());

		expect(summary).toEqual({
			id: 1,
			brandId: 'brand-1',
			productId: null,
			accessoryProductId: 'acc-1',
			priceMode: BrandAccessoryPriceMode.COURTESY,
			customPrice: null,
			currentProductPrice: 8,
			isActive: true,
			accessory: {
				id: 'acc-1',
				name: 'Estuche Ray-Ban rígido',
				sku: 'EST-RB-01',
				stock: 5,
				type: ProductType.ACCESSORY,
				currentSalePrice: 8
			}
		});
	});
});
