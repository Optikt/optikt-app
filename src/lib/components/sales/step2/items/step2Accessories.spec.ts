import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscountType } from '$lib/shared/enums/salesTypes';
import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
import { ProductType } from '$lib/shared/enums/productTypes';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { ProductSaleItemRow, SaleItemRow } from '../../newSaleTypes';
import type { IncludedAccessoryMap } from '../../includedAccessories';
import type { IncludedAccessoryRule } from './step2Accessories';

const toastWarning = vi.fn();
const toastInfo = vi.fn();
const toastError = vi.fn();
const getAccessoriesForProduct = vi.fn();
const cacheProduct = vi.fn();

vi.mock('svelte-sonner', () => ({
	toast: {
		warning: (...a: unknown[]) => toastWarning(...a),
		info: (...a: unknown[]) => toastInfo(...a),
		error: (...a: unknown[]) => toastError(...a)
	}
}));
vi.mock('$lib/remote/brandAccessories.remote', () => ({
	getAccessoriesForProduct: (p: unknown) => getAccessoriesForProduct(p)
}));
vi.mock('../../catalogCache.svelte', () => ({
	cacheProduct: (p: unknown) => cacheProduct(p)
}));

const {
	buildIncludedAccessoriesForParent,
	createIncludedAccessoryItem,
	fetchAndLinkIncludedAccessories,
	syncStep2AccessoryQuantities
} = await import('./step2Accessories');

function rule(overrides: Record<string, unknown> = {}): IncludedAccessoryRule {
	return {
		accessoryProductId: 'acc-1',
		priceMode: BrandAccessoryPriceMode.COURTESY,
		customPrice: null,
		currentProductPrice: 12,
		accessory: {
			id: 'acc-1',
			name: 'Estuche',
			stock: 5,
			sku: 'EST-1',
			type: 'ACCESSORY'
		} as unknown as ProductWithRelations,
		...overrides
	} as IncludedAccessoryRule;
}

function parentRow(id = 'frame-1', quantity = 1): ProductSaleItemRow {
	return {
		id,
		kind: 'product',
		productId: 'prod-frame',
		quantity,
		unitPrice: 60,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null
	};
}

beforeEach(() => {
	for (const fn of [toastWarning, toastInfo, toastError, getAccessoriesForProduct, cacheProduct]) {
		fn.mockReset();
	}
});

describe('step2Accessories', () => {
	it('creates included accessory rows for FREE, PRODUCT, and CUSTOM price modes', () => {
		const free = createIncludedAccessoryItem('p1', rule({ priceMode: 'FREE' }));
		const prod = createIncludedAccessoryItem(
			'p1',
			rule({ priceMode: 'PRODUCT', currentProductPrice: 15 })
		);
		const custom = createIncludedAccessoryItem('p1', rule({ priceMode: 'CUSTOM', customPrice: 7 }));
		const fallback = createIncludedAccessoryItem(
			'p1',
			rule({ priceMode: 'CUSTOM', customPrice: null })
		);

		expect(free.unitPrice).toBe(0);
		expect(prod.unitPrice).toBe(15);
		expect(custom.unitPrice).toBe(7);
		expect(fallback.unitPrice).toBe(0);
		expect(free.isIncludedAccessory).toBe(true);
		expect(cacheProduct).toHaveBeenCalledTimes(4);
	});

	it('splits out-of-stock accessories and caps quantity to accessory stock', () => {
		const res = buildIncludedAccessoriesForParent('p1', 4, [
			rule({ accessoryProductId: 'acc-1', accessory: { id: 'acc-1', name: 'Estuche', stock: 2 } }),
			rule({ accessoryProductId: 'acc-2', accessory: { id: 'acc-2', name: 'Pañito', stock: 0 } })
		]);

		expect(res.accessoryItems).toHaveLength(1);
		expect(res.accessoryItems[0].quantity).toBe(2);
		expect(res.addedNames).toEqual(['Estuche']);
		expect(res.outOfStockNames).toEqual(['Pañito']);
	});

	it('fetches, links, warns on out-of-stock/errors and skips non-eligible options', async () => {
		let items: SaleItemRow[] = [parentRow('p1', 2)];
		let map: IncludedAccessoryMap = {};
		const onLinked = vi.fn();
		const state = {
			getItems: () => items,
			getMap: () => map,
			setItems: (next: SaleItemRow[]) => (items = next),
			setMap: (next: IncludedAccessoryMap) => (map = next),
			onLinked
		};

		// Non-eligible option → no query
		await fetchAndLinkIncludedAccessories(
			{ kind: 'lens', id: 'l1', brandId: 'b1', productType: ProductType.FRAME },
			'p1',
			state
		);
		expect(getAccessoriesForProduct).not.toHaveBeenCalled();

		// Happy path with 2 accessories + 1 out-of-stock
		getAccessoriesForProduct.mockResolvedValueOnce([
			rule({ accessoryProductId: 'a1', accessory: { id: 'a1', name: 'Estuche', stock: 5 } }),
			rule({ accessoryProductId: 'a2', accessory: { id: 'a2', name: 'Pañito', stock: 5 } }),
			rule({ accessoryProductId: 'a3', accessory: { id: 'a3', name: 'Cordón', stock: 0 } })
		]);
		await fetchAndLinkIncludedAccessories(
			{ kind: 'product', id: 'f1', brandId: 'b1', productType: ProductType.FRAME },
			'p1',
			state
		);
		expect(items).toHaveLength(3);
		expect(map.p1).toHaveLength(2);
		expect(onLinked).toHaveBeenCalledWith('p1');
		expect(toastWarning).toHaveBeenCalledTimes(1);
		expect(toastInfo).toHaveBeenCalledTimes(1);

		// Parent removed before response resolves → no-op
		getAccessoriesForProduct.mockResolvedValueOnce([rule()]);
		await fetchAndLinkIncludedAccessories(
			{ kind: 'product', id: 'f1', brandId: 'b1', productType: ProductType.FRAME },
			'missing',
			state
		);
		expect(items).toHaveLength(3);

		// Empty accessories (all out of stock)
		getAccessoriesForProduct.mockResolvedValueOnce([
			rule({ accessory: { id: 'a3', name: 'Sin stock', stock: 0 } })
		]);
		await fetchAndLinkIncludedAccessories(
			{ kind: 'product', id: 'f1', brandId: 'b1', productType: ProductType.FRAME },
			'p1',
			state
		);
		expect(items).toHaveLength(3);

		// Remote failure → error toast
		getAccessoriesForProduct.mockRejectedValueOnce(new Error('fallo de red'));
		await fetchAndLinkIncludedAccessories(
			{ kind: 'product', id: 'f1', brandId: 'b1', productType: ProductType.FRAME },
			'p1',
			state
		);
		expect(toastError).toHaveBeenCalledWith('fallo de red');
	});

	it('syncs linked accessory quantities and warns when capped by stock', () => {
		const p = parentRow('p1', 1);
		const a: SaleItemRow = {
			...parentRow('a1', 1),
			productId: 'prod-acc',
			isIncludedAccessory: true,
			includedAccessoryParentItemId: 'p1'
		};
		const products = [
			{ id: 'prod-acc', name: 'Kit Palazzo', stock: 2 }
		] as unknown as ProductWithRelations[];

		const synced = syncStep2AccessoryQuantities([p, a], { p1: ['a1'] }, 'p1', 4, products);
		expect(synced.find((i) => i.id === 'a1')?.quantity).toBe(2);
		expect(toastWarning).toHaveBeenCalledWith('⚠ Kit Palazzo solo tiene 2 en stock.');
	});

	it('respects remaining stock across two frames sharing the same accessory', () => {
		const p1 = parentRow('p1', 2);
		const p2 = parentRow('p2', 2);
		const a1: SaleItemRow = {
			...parentRow('a1', 2),
			productId: 'acc-1',
			isIncludedAccessory: true,
			includedAccessoryParentItemId: 'p1'
		};

		// Stock is 3 and a1 already takes 2 → p2 gets only 1 accessory instead of 2
		const built = buildIncludedAccessoriesForParent(
			'p2',
			2,
			[rule({ accessory: { id: 'acc-1', name: 'Estuche', stock: 3 } })],
			[p1, a1, p2]
		);
		expect(built.accessoryItems).toHaveLength(1);
		expect(built.accessoryItems[0].quantity).toBe(1);

		const a2: SaleItemRow = {
			...parentRow('a2', 1),
			productId: 'acc-1',
			isIncludedAccessory: true,
			includedAccessoryParentItemId: 'p2'
		};
		const products = [
			{ id: 'acc-1', name: 'Estuche', stock: 3 }
		] as unknown as ProductWithRelations[];

		// Increasing p2 to 3 cannot allocate more than remaining stock (3 - 2 = 1)
		const synced = syncStep2AccessoryQuantities(
			[p1, a1, p2, a2],
			{ p2: ['a2'] },
			'p2',
			3,
			products
		);
		expect(synced.find((i) => i.id === 'a2')?.quantity).toBe(1);
		expect(toastWarning).toHaveBeenCalledWith(
			'⚠ Estuche: solo quedan 1 disponibles de 3 en stock.'
		);
	});
});
