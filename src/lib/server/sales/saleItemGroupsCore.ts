/**
 * Persistence of per-person groups + primary lens for a sale, shared by
 * `updateSale` (after the item replacement) and the groups-only command
 * `saveSaleItemGroups`. Runs inside the caller's transaction.
 */
import { eq } from 'drizzle-orm';
import {
	findSaleGroupableItems,
	replaceSaleItemGroups,
	setSalePrimaryLens
} from '$lib/server/db/queries/sales/itemGroups';
import { prescriptions, type Prescription } from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import {
	applyPrimaryPrescription,
	findLensCatalogType,
	prescriptionFromLensLine
} from '$lib/server/sales/primaryPrescription';
import {
	clampAllocations,
	dropEmptyGroups,
	normalizeGroupsForSubmit,
	summarizeGroups,
	type ItemGroup
} from '$lib/shared/saleItemGroups';
import { nowUTC, toISODate } from '$lib/dates';

type SaleLine = Awaited<ReturnType<typeof findSaleGroupableItems>>[number];

export interface PersistSaleGroupsInput {
	saleId: string;
	customerId: string;
	/** New groups with REAL live item ids; undefined = leave groups untouched. */
	groups?: readonly ItemGroup[];
	/** New primary lens (real id); undefined = leave untouched. */
	primaryLensItemId?: string | null;
	/** Primary before the change (real id of the same logical line, already remapped). */
	previousPrimaryLensItemId: string | null;
}

export interface PersistSaleGroupsResult {
	groups: ItemGroup[] | null;
	primaryLensItemId: string | null | undefined;
	prescription: Prescription | null;
	lines: SaleLine[];
}

export async function persistSaleGroups(
	tx: DbOrTx,
	input: PersistSaleGroupsInput
): Promise<PersistSaleGroupsResult> {
	const lines = await findSaleGroupableItems(input.saleId, tx);

	let savedGroups: ItemGroup[] | null = null;
	if (input.groups !== undefined) {
		// Server-side safety net: drop dead/treatment members, clamp Σ to qty.
		savedGroups = normalizeGroupsForSubmit(dropEmptyGroups(clampAllocations(input.groups, lines)));
		await replaceSaleItemGroups(input.saleId, savedGroups, tx);
	}

	let primary: string | null | undefined = undefined;
	let prescription: Prescription | null = null;
	if (input.primaryLensItemId !== undefined) {
		const line = input.primaryLensItemId
			? lines.find((l) => l.id === input.primaryLensItemId && l.itemType === 'LENS_PAIR')
			: undefined;
		primary = line?.id ?? null;
		await setSalePrimaryLens(input.saleId, primary, tx);

		// A new primary lens creates a new current prescription; unmarking
		// deletes nothing (the old one stays in the customer's history).
		if (line && primary !== input.previousPrimaryLensItemId) {
			prescription = await createPrimaryFromLine(tx, input.customerId, line);
		}
	}

	return { groups: savedGroups, primaryLensItemId: primary, prescription, lines };
}

async function createPrimaryFromLine(
	tx: DbOrTx,
	customerId: string,
	line: SaleLine
): Promise<Prescription | null> {
	const lensType = await findLensCatalogType(line.lensCatalogItemId, tx);
	const fields = prescriptionFromLensLine(line, toISODate(nowUTC()), lensType);
	if (!fields) return null;

	// Keep the doctor of the Rx the lens was linked to, when there is one.
	if (line.prescriptionId) {
		const [linked] = await tx
			.select({ doctorName: prescriptions.doctorName })
			.from(prescriptions)
			.where(eq(prescriptions.id, line.prescriptionId));
		if (linked?.doctorName) fields.doctorName = linked.doctorName;
	}

	return applyPrimaryPrescription(tx, { customerId, saleItemId: line.id, fields });
}

/** Audit change record for the "Agrupación por persona" history entry. */
export function groupsAuditChanges(input: {
	before: readonly ItemGroup[];
	after: readonly ItemGroup[] | null;
	beforePrimary: string | null;
	afterPrimary: string | null | undefined;
	nameOf: (itemId: string) => string;
}): Record<string, { old: unknown; new: unknown }> {
	const changes: Record<string, { old: unknown; new: unknown }> = {};
	if (input.after) {
		const oldText = summarizeGroups(input.before, input.nameOf);
		const newText = summarizeGroups(input.after, input.nameOf);
		if (oldText !== newText) changes.personGroups = { old: oldText, new: newText };
	}
	if (input.afterPrimary !== undefined && input.afterPrimary !== input.beforePrimary) {
		changes.primaryLens = {
			old: input.beforePrimary ? input.nameOf(input.beforePrimary) : 'Ninguna',
			new: input.afterPrimary ? input.nameOf(input.afterPrimary) : 'Ninguna'
		};
	}
	return changes;
}
