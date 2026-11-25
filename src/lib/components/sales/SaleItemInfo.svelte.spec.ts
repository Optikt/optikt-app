import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
import { ProductType } from '$lib/shared/enums/productTypes';
import { cacheProduct, getCachedLensItems, getCachedProducts } from './catalogCache.svelte';
import { createEmptyFreeItem, createEmptyProductItem } from './newSaleTypes';
import SaleItemInfo from './SaleItemInfo.svelte';
import { createIncludedAccessoryItem } from './step2/items/step2Accessories';
import { CATALOG_KEY, type CatalogData } from './wizardContext';

function makeContext(): Map<unknown, unknown> {
	const catalog: CatalogData = {
		getProducts: getCachedProducts,
		getLensItems: getCachedLensItems
	};
	return new Map([[CATALOG_KEY, catalog]]);
}

const accessoryProduct = {
	id: 'acc-cached-1',
	sku: 'EST-001',
	name: 'Estuche rígido incluido',
	type: ProductType.ACCESSORY,
	brandId: 'brand-1',
	supplierId: 'sup-1',
	materialId: 'mat-1',
	description: 'Con paño de microfibra',
	currentPurchasePrice: 1,
	currentSalePrice: 5,
	isAutoSku: false,
	isTaxable: true,
	stock: 4,
	brand: { id: 'brand-1', name: 'Oakley' },
	supplier: { id: 'sup-1', name: 'Proveedor' },
	material: { id: 'mat-1', name: 'Plástico', code: 'PLA' }
} as unknown as ProductWithRelations;

test('muestra nombre real, marca y badge de accesorio cuando el accesorio está en catalogCache', async () => {
	cacheProduct(accessoryProduct);
	const item = createIncludedAccessoryItem('frame-parent-1', {
		accessoryProductId: accessoryProduct.id,
		priceMode: BrandAccessoryPriceMode.COURTESY,
		customPrice: null,
		currentProductPrice: accessoryProduct.currentSalePrice,
		accessory: accessoryProduct
	});

	const screen = await render(SaleItemInfo, {
		props: { item, showAccessoryBadge: true },
		context: makeContext()
	});

	expect(screen.container.textContent).toContain('Estuche rígido incluido');
	expect(screen.container.textContent).toContain('Oakley');
	expect(screen.container.textContent).toContain('Accesorio');
	expect(screen.container.textContent).not.toContain('Ítem libre');
});

test('no etiqueta como "Ítem libre" a un producto ausente del caché', async () => {
	const item = createEmptyProductItem('missing-product-id');

	const screen = await render(SaleItemInfo, {
		props: { item },
		context: makeContext()
	});

	expect(screen.container.textContent).toContain('Producto');
	expect(screen.container.textContent).not.toContain('Ítem libre');
});

test('muestra la descripción en ítems realmente libres y cae a "Ítem libre" si está vacía', async () => {
	const emptyFree = createEmptyFreeItem();
	const s1 = await render(SaleItemInfo, {
		props: { item: emptyFree },
		context: makeContext()
	});
	expect(s1.container.textContent).toContain('Ítem libre');

	const namedFree = createEmptyFreeItem();
	namedFree.freeItem.description = 'Lente de contacto blando';
	const s2 = await render(SaleItemInfo, {
		props: { item: namedFree },
		context: makeContext()
	});
	expect(s2.container.textContent).toContain('Lente de contacto blando');
});
