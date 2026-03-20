import type { CoreLensTreatmentCode, LensTreatmentPolicy } from '$lib/shared/contracts/lenses';
import { LensTreatmentAvailability } from '$lib/shared/contracts/lenses';
import { CORE_LENS_TREATMENT_CODES } from '$lib/shared/contracts/lenses';

/**
 * Resolve final treatment policies for a catalog item by merging:
 *   1. Defaults — one entry per CoreLensTreatmentCode with NOT_AVAILABLE
 *   2. Supplier-level defaults (from supplier_treatment_policies table)
 *   3. Item-level overrides (stored in the catalog item's treatmentPolicies JSON)
 *
 * Later layers win. Returns one LensTreatmentPolicy per CoreLensTreatmentCode.
 */
export function resolveTreatmentPolicies(
	supplierDefaults: LensTreatmentPolicy[],
	itemOverrides: LensTreatmentPolicy[]
): LensTreatmentPolicy[] {
	const map = new Map<CoreLensTreatmentCode, LensTreatmentPolicy>();

	// Layer 0: base defaults — everything NOT_AVAILABLE
	for (const code of CORE_LENS_TREATMENT_CODES) {
		map.set(code, {
			code,
			availability: LensTreatmentAvailability.NOT_AVAILABLE,
			additionalPrice: 0,
			requiresConfirmation: false
		});
	}

	// Layer 1: supplier defaults
	for (const policy of supplierDefaults) {
		map.set(policy.code, { ...policy });
	}

	// Layer 2: item overrides
	for (const policy of itemOverrides) {
		map.set(policy.code, { ...policy });
	}

	return Array.from(map.values());
}
