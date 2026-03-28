import { eq, and, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	supplierTreatmentPolicies,
	type SupplierTreatmentPolicy,
	type NewSupplierTreatmentPolicy
} from '$lib/server/db/schema';

// ============================================================================
// READS
// ============================================================================

export async function getSupplierTreatmentPolicies(
	supplierId: string,
	executor: DbOrTx = db
): Promise<SupplierTreatmentPolicy[]> {
	return executor
		.select()
		.from(supplierTreatmentPolicies)
		.where(eq(supplierTreatmentPolicies.supplierId, supplierId));
}

/**
 * Batch-load treatment policies for multiple suppliers in a single query.
 * Returns a map: supplierId → SupplierTreatmentPolicy[]
 */
export async function getSupplierTreatmentPoliciesByIds(
	supplierIds: string[],
	executor: DbOrTx = db
): Promise<Map<string, SupplierTreatmentPolicy[]>> {
	const map = new Map<string, SupplierTreatmentPolicy[]>();
	if (supplierIds.length === 0) return map;

	const rows = await executor
		.select()
		.from(supplierTreatmentPolicies)
		.where(inArray(supplierTreatmentPolicies.supplierId, supplierIds));

	for (const row of rows) {
		const existing = map.get(row.supplierId);
		if (existing) {
			existing.push(row);
		} else {
			map.set(row.supplierId, [row]);
		}
	}

	return map;
}

// ============================================================================
// WRITES
// ============================================================================

export async function upsertSupplierTreatmentPolicy(
	data: NewSupplierTreatmentPolicy,
	executor: DbOrTx = db
): Promise<SupplierTreatmentPolicy> {
	const now = new Date();
	const [row] = await executor
		.insert(supplierTreatmentPolicies)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [supplierTreatmentPolicies.supplierId, supplierTreatmentPolicies.code],
			set: {
				availability: data.availability,
				additionalPrice: data.additionalPrice,
				requiresConfirmation: data.requiresConfirmation,
				updatedAt: now
			}
		})
		.returning();
	return row;
}

export async function deleteSupplierTreatmentPolicy(
	supplierId: string,
	code: string,
	executor: DbOrTx = db
): Promise<SupplierTreatmentPolicy | null> {
	const [row] = await executor
		.delete(supplierTreatmentPolicies)
		.where(
			and(
				eq(supplierTreatmentPolicies.supplierId, supplierId),
				eq(supplierTreatmentPolicies.code, code)
			)
		)
		.returning();
	return row ?? null;
}
