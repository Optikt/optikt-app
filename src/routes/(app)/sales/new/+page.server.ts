import type { PageServerLoad } from './$types';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';
import { getSupplierTreatmentPoliciesByIds } from '$lib/server/db/queries/supplierTreatmentPolicies';
import { findAvailableSurplusForItems } from '$lib/server/db/queries/surplusUnits';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { buildCatalogItemForPlanning } from '$lib/shared/planning';
import type { CatalogItemForPlanning, SurplusUnitForPlanning } from '$lib/shared/planning';
import { toTreatmentPolicy } from '$lib/shared/contracts/lenses';
import type { CoreLensTreatmentCode, LensTreatmentAvailability } from '$lib/shared/contracts/lenses';

export const load: PageServerLoad = async () => {
	// Phase 1: load core data in parallel
	const [productsList, lensItemsList, nextOrderNumber, suppliersList] = await Promise.all([
		getAllProductsWithRelations({ orderBy: 'name' }),
		getLensCatalogItemsWithRelations(),
		getNextOrderNumber(),
		getAllSuppliers({ orderBy: 'name' })
	]);

	// Phase 2: derive supplier IDs and item IDs, then batch-load policies + surplus
	const supplierIdSet = new Set<string>();
	const catalogItemIds: string[] = [];
	// One single loop to full both
	for (const item of lensItemsList) {
		supplierIdSet.add(item.supplierId);
		catalogItemIds.push(item.id);
	}

	const [supplierPoliciesMap, surplusMap] = await Promise.all([
		getSupplierTreatmentPoliciesByIds([...supplierIdSet]),
		findAvailableSurplusForItems(catalogItemIds)
	]);

	// Build resolved catalog items for the fulfillment planner
	const catalogItems: CatalogItemForPlanning[] = lensItemsList.map((item) => {
		const supplierDefaults = (supplierPoliciesMap.get(item.supplierId) ?? []).map((p) =>
			toTreatmentPolicy(p.code as CoreLensTreatmentCode, {
				availability: p.availability as LensTreatmentAvailability,
				additionalPrice: p.additionalPrice,
				requiresConfirmation: p.requiresConfirmation
			})
		);
		return buildCatalogItemForPlanning(item, supplierDefaults);
	});

	// Map surplus units from DB shape → planner shape
	const availableSurplus: SurplusUnitForPlanning[] = [];
	for (const units of surplusMap.values()) {
		for (const unit of units) {
			availableSurplus.push({
				id: unit.id,
				catalogItemId: unit.catalogItemId,
				prescription: unit.physicalSignature.prescription,
				appliedOptionalTreatments: unit.physicalSignature.requiredTreatments,
				costSnapshot: unit.costSnapshot
			});
		}
	}

	return {
		products: productsList,
		lensItems: lensItemsList,
		catalogItems,
		availableSurplus,
		suppliers: suppliersList,
		nextOrderNumber
	};
};
