/**
 * Per-person grouping of sale lines (sale_item_groups / sale_item_group_members)
 * and the sale's primary lens ("fórmula principal").
 *
 * Groups are organization metadata: hard-deleted and replaced as a whole,
 * never trashed, never touch money or inventory.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { lensCatalogItems } from '$lib/server/db/schema/lenses';
import {
	saleItemGroupMembers,
	saleItemGroups,
	saleItems,
	sales
} from '$lib/server/db/schema/sales';
import { nowISO } from '$lib/dates';
import type { ItemGroup } from '$lib/shared/saleItemGroups';

export interface SaleItemGroupRecord extends ItemGroup {
	id: string;
	position: number;
}

/** Groups of a sale ordered by position, members in insertion order. Only live items. */
export async function findSaleItemGroups(
	saleId: string,
	executor: DbOrTx = db
): Promise<SaleItemGroupRecord[]> {
	const groups = await executor
		.select()
		.from(saleItemGroups)
		.where(eq(saleItemGroups.saleId, saleId))
		.orderBy(asc(saleItemGroups.position), asc(saleItemGroups.id));
	if (groups.length === 0) return [];

	const members = await executor
		.select({
			groupId: saleItemGroupMembers.groupId,
			itemId: saleItemGroupMembers.saleItemId,
			quantity: saleItemGroupMembers.quantity
		})
		.from(saleItemGroupMembers)
		.innerJoin(saleItems, eq(saleItems.id, saleItemGroupMembers.saleItemId))
		.where(
			and(
				inArray(
					saleItemGroupMembers.groupId,
					groups.map((g) => g.id)
				),
				isNull(saleItems.deletedAt)
			)
		)
		.orderBy(asc(saleItems.createdAt), asc(saleItems.id));

	return groups.map((group) => ({
		id: group.id,
		position: group.position,
		label: group.label,
		members: members
			.filter((m) => m.groupId === group.id)
			.map((m) => ({ itemId: m.itemId, quantity: m.quantity }))
	}));
}

/**
 * Replace all groups of a sale (delete + insert). Members must already be
 * real, live sale item ids and pre-validated (`validateItemGroups`).
 * Empty groups are skipped.
 */
export async function replaceSaleItemGroups(
	saleId: string,
	groups: readonly ItemGroup[],
	executor: DbOrTx = db
): Promise<void> {
	await executor.delete(saleItemGroups).where(eq(saleItemGroups.saleId, saleId));

	const now = nowISO();
	const groupRows: {
		id: string;
		saleId: string;
		label: string | null;
		position: number;
		createdAt: string;
		updatedAt: string;
	}[] = [];
	const memberRows: { groupId: string; saleItemId: string; quantity: number }[] = [];

	let position = 0;
	for (const group of groups) {
		if (group.members.length === 0) continue;
		const groupId = crypto.randomUUID();
		groupRows.push({
			id: groupId,
			saleId,
			label: group.label,
			position: position++,
			createdAt: now,
			updatedAt: now
		});
		for (const member of group.members) {
			memberRows.push({ groupId, saleItemId: member.itemId, quantity: member.quantity });
		}
	}

	if (groupRows.length > 0) {
		await executor.insert(saleItemGroups).values(groupRows);
	}
	if (memberRows.length > 0) {
		await executor.insert(saleItemGroupMembers).values(memberRows);
	}
}

export async function setSalePrimaryLens(
	saleId: string,
	saleItemId: string | null,
	executor: DbOrTx = db
): Promise<void> {
	await executor
		.update(sales)
		.set({ primaryLensItemId: saleItemId, updatedAt: nowISO() })
		.where(eq(sales.id, saleId));
}

export interface LockedSaleForGroups {
	status: string;
	customerId: string;
	primaryLensItemId: string | null;
}

/**
 * Locks the sale row (`FOR UPDATE`) and returns its current status, customer,
 * and primary lens. Concurrent group saves and item edits serialize here so
 * only one sees the primary as "changed" or acts on stale items/status.
 */
export async function lockSaleForGroups(
	saleId: string,
	tx: DbOrTx
): Promise<LockedSaleForGroups | null> {
	const [row] = await tx
		.select({
			status: sales.status,
			customerId: sales.customerId,
			primaryLensItemId: sales.primaryLensItemId
		})
		.from(sales)
		.where(and(eq(sales.id, saleId), isNull(sales.deletedAt)))
		.for('update');
	return row ?? null;
}

/** Links one sale line to a prescription (the primary lens → the new current Rx). */
export async function setSaleItemPrescription(
	saleItemId: string,
	prescriptionId: string,
	executor: DbOrTx = db
): Promise<void> {
	await executor
		.update(saleItems)
		.set({ prescriptionId, updatedAt: nowISO() })
		.where(eq(saleItems.id, saleItemId));
}

/** Lens type of a catalog lens (recommended lens type of the derived Rx). */
export async function findLensCatalogType(
	lensCatalogItemId: string | null,
	executor: DbOrTx = db
): Promise<string | null> {
	if (!lensCatalogItemId) return null;
	const [row] = await executor
		.select({ type: lensCatalogItems.type })
		.from(lensCatalogItems)
		.where(eq(lensCatalogItems.id, lensCatalogItemId));
	return row?.type ?? null;
}

/** Live lines of a sale in the minimal shape the grouping helpers need. */
export async function findSaleGroupableItems(saleId: string, executor: DbOrTx = db) {
	return executor
		.select({
			id: saleItems.id,
			itemType: saleItems.itemType,
			quantity: saleItems.quantity,
			parentId: saleItems.parentSaleItemId,
			snapshotName: saleItems.snapshotName,
			prescriptionId: saleItems.prescriptionId,
			odSphere: saleItems.odSphere,
			odCylinder: saleItems.odCylinder,
			odAxis: saleItems.odAxis,
			odAddition: saleItems.odAddition,
			odAltura: saleItems.odAltura,
			osSphere: saleItems.osSphere,
			osCylinder: saleItems.osCylinder,
			osAxis: saleItems.osAxis,
			osAddition: saleItems.osAddition,
			osAltura: saleItems.osAltura,
			dp: saleItems.dp,
			npRight: saleItems.npRight,
			npLeft: saleItems.npLeft,
			lensCatalogItemId: saleItems.lensCatalogItemId
		})
		.from(saleItems)
		.where(and(eq(saleItems.saleId, saleId), isNull(saleItems.deletedAt)))
		.orderBy(asc(saleItems.createdAt), asc(saleItems.id));
}
