/**
 * Shared test fixtures for the purchase draft module specs (draft/*.spec.ts).
 * Not a spec file — only factories used to build products/lenses.
 */

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { LensPriceType, LensType } from '$lib/shared/enums/lensTypes';

export function makeProduct(overrides: Partial<ProductWithRelations> = {}): ProductWithRelations {
	return {
		id: 'product-1',
		sku: 'MON-001',
		name: 'Montura acetato',
		currentPurchasePrice: 18,
		currentSalePrice: 42,
		isTaxable: true,
		supplierId: 'supplier-1',
		brand: { name: 'Optikt' },
		supplier: { name: 'Distribuidora Norte' },
		...overrides
	} as ProductWithRelations;
}

export function makeLens(
	overrides: Partial<LensCatalogItemWithRelations> = {}
): LensCatalogItemWithRelations {
	return {
		id: 'lens-1',
		name: 'Blue Cut 1.56',
		type: LensType.MONOFOCAL,
		priceType: LensPriceType.PAIR,
		pairPurchasePrice: 24,
		basePrice: 14,
		salePrice: 52,
		isTaxable: false,
		supplierId: 'supplier-1',
		material: { name: 'CR-39' },
		supplier: { name: 'Lab Express' },
		...overrides
	} as LensCatalogItemWithRelations;
}
