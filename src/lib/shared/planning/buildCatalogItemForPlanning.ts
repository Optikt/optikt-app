import type { LensTreatmentPolicy, LensPurchasePolicy } from '$lib/shared/contracts/lenses';
import type { CatalogItemForPlanning } from './types';
import { resolveTreatmentPolicies } from './resolveTreatmentPolicies';

/**
 * Raw shape from the DB lens_catalog_items table.
 * Only the columns the builder needs — avoids coupling to Drizzle types.
 */
export interface RawCatalogItem {
	id: string;
	name: string;
	basePrice: number;
	pricingUnit: string;
	allowsSingleUnitOrder: boolean;
	singleUnitRequiresConfirmation: boolean;
	singleUnitSurcharge: number;
	minimumOrderUnits: number;
	mountingPrice: number;
	shippingPrice: number;
	treatmentPolicies: LensTreatmentPolicy[];
}

/**
 * Single conversion point: DB catalog item + supplier defaults → CatalogItemForPlanning.
 *
 * Resolves treatment policies (supplier defaults → item overrides) and assembles
 * the purchase policy from flat DB columns into the contract shape.
 */
export function buildCatalogItemForPlanning(
	raw: RawCatalogItem,
	supplierDefaults: LensTreatmentPolicy[]
): CatalogItemForPlanning {
	const purchasePolicy: LensPurchasePolicy = {
		listOrderUnit: raw.pricingUnit as LensPurchasePolicy['listOrderUnit'],
		requiresSamePrescriptionForPair: false,
		allowsSingleUnitOrder: raw.allowsSingleUnitOrder,
		singleUnitRequiresConfirmation: raw.singleUnitRequiresConfirmation,
		singleUnitSurcharge: raw.singleUnitSurcharge,
		minimumOrderUnits: raw.minimumOrderUnits,
		mountingPrice: raw.mountingPrice,
		shippingPrice: raw.shippingPrice
	};

	return {
		id: raw.id,
		name: raw.name,
		basePrice: raw.basePrice,
		purchasePolicy,
		treatmentPolicies: resolveTreatmentPolicies(supplierDefaults, raw.treatmentPolicies)
	};
}
