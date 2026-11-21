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
import { saleItemGroupMembers, saleItemGroups, saleItems, sales } from '$lib/server/db/schema';
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
		.orderBy(asc(saleItemGroups.position));
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
		.orderBy(asc(saleItems.createdAt));

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
	let position = 0;
	for (const group of groups) {
		if (group.members.length === 0) continue;
		const groupId = crypto.randomUUID();
		await executor.insert(saleItemGroups).values({
			id: groupId,
			saleId,
			label: group.label,
			position: position++,
			createdAt: now,
			updatedAt: now
		});
		await executor
			.insert(saleItemGroupMembers)
			.values(group.members.map((m) => ({ groupId, saleItemId: m.itemId, quantity: m.quantity })));
	}
}

export async function setSalePrimaryLens(
	saleId: string,
	saleItemId: string | null,
	executor: DbOrTx = db
): Promise<void> {
	await executor.update(sales).set({ primaryLensItemId: saleItemId }).where(eq(sales.id, saleId));
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
		.orderBy(asc(saleItems.createdAt));
}
