/**
 * Persistence of per-person groups + primary lens for a sale, shared by
 * `updateSale` (after the item replacement) and the groups-only command
 * `saveSaleItemGroups`. Runs inside the caller's transaction.
 */
import { findPrescriptionById } from '$lib/server/db/queries/customers';
import {
	findLensCatalogType,
	findSaleGroupableItems,
	replaceSaleItemGroups,
	setSalePrimaryLens
} from '$lib/server/db/queries/sales/itemGroups';
import type { Prescription } from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import {
	applyPrimaryPrescription,
	prescriptionFromLensLine,
	sameLensRx,
	type LensRxSnapshot
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
	/** Graduation of the primary line before the edit (item replacement only). */
	previousPrimaryRx?: LensRxSnapshot | null;
	/** The sale moved to another customer: the new one gets the current Rx. */
	customerChanged?: boolean;
	/** Optional DP/NP measures edited in the same save (merged when a new Rx is created). */
	measures?: { dp?: number | null; npRight?: number | null; npLeft?: number | null };
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

		// A new primary lens creates a new current prescription; so does the
		// same primary when the sale changes customer or its graduation was
		// edited. Unmarking deletes nothing (the old one stays in the history).
		const refresh =
			primary !== input.previousPrimaryLensItemId ||
			!!input.customerChanged ||
			(!!input.previousPrimaryRx && !!line && !sameLensRx(input.previousPrimaryRx, line));
		if (line && refresh) {
			prescription = await createPrimaryFromLine(tx, input.customerId, line, input.measures);
		}
	}

	return { groups: savedGroups, primaryLensItemId: primary, prescription, lines };
}

async function createPrimaryFromLine(
	tx: DbOrTx,
	customerId: string,
	line: SaleLine,
	measures?: { dp?: number | null; npRight?: number | null; npLeft?: number | null }
): Promise<Prescription | null> {
	const lensType = await findLensCatalogType(line.lensCatalogItemId, tx);
	const effectiveLine = measures
		? {
				...line,
				dp: measures.dp !== undefined ? measures.dp : line.dp,
				npRight: measures.npRight !== undefined ? measures.npRight : line.npRight,
				npLeft: measures.npLeft !== undefined ? measures.npLeft : line.npLeft
			}
		: line;
	const fields = prescriptionFromLensLine(effectiveLine, toISODate(nowUTC()), lensType);
	if (!fields) return null;

	// Keep the doctor of the Rx the lens was linked to, when there is one.
	if (line.prescriptionId) {
		const linked = await findPrescriptionById(line.prescriptionId, tx);
		if (linked?.doctorName) fields.doctorName = linked.doctorName;
	}

	return applyPrimaryPrescription(tx, { customerId, saleItemId: line.id, fields });
}

/** Audit change record for the "Agrupación por persona" history entry. */
export function groupsAuditChanges(input: {
	before: readonly ItemGroup[];
	after: readonly ItemGroup[] | null;
	beforePrimary: string | null;
	/** Remapped id of `beforePrimary` after item replacement (defaults to `beforePrimary`). */
	logicalBeforePrimary?: string | null;
	afterPrimary: string | null | undefined;
	nameOf: (itemId: string) => string;
}): Record<string, { old: unknown; new: unknown }> {
	const changes: Record<string, { old: unknown; new: unknown }> = {};
	if (input.after) {
		const oldText = summarizeGroups(input.before, input.nameOf);
		const newText = summarizeGroups(input.after, input.nameOf);
		if (oldText !== newText) changes.personGroups = { old: oldText, new: newText };
	}
	const compareBefore =
		input.logicalBeforePrimary !== undefined ? input.logicalBeforePrimary : input.beforePrimary;
	if (input.afterPrimary !== undefined && input.afterPrimary !== compareBefore) {
		changes.primaryLens = {
			old: input.beforePrimary ? input.nameOf(input.beforePrimary) : 'Ninguna',
			new: input.afterPrimary ? input.nameOf(input.afterPrimary) : 'Ninguna'
		};
	}
	return changes;
}
