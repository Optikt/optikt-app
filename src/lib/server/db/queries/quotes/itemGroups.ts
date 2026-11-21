/**
 * Per-person grouping of quote lines (mirror of sales/itemGroups, no primary lens).
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { quoteItemGroupMembers, quoteItemGroups, quoteItems } from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';
import type { ItemGroup } from '$lib/shared/saleItemGroups';

export interface QuoteItemGroupRecord extends ItemGroup {
	id: string;
	position: number;
}

export async function findQuoteItemGroups(
	quoteId: string,
	executor: DbOrTx = db
): Promise<QuoteItemGroupRecord[]> {
	const groups = await executor
		.select()
		.from(quoteItemGroups)
		.where(eq(quoteItemGroups.quoteId, quoteId))
		.orderBy(asc(quoteItemGroups.position));
	if (groups.length === 0) return [];

	const members = await executor
		.select({
			groupId: quoteItemGroupMembers.groupId,
			itemId: quoteItemGroupMembers.quoteItemId,
			quantity: quoteItemGroupMembers.quantity
		})
		.from(quoteItemGroupMembers)
		.innerJoin(quoteItems, eq(quoteItems.id, quoteItemGroupMembers.quoteItemId))
		.where(
			and(
				inArray(
					quoteItemGroupMembers.groupId,
					groups.map((g) => g.id)
				),
				isNull(quoteItems.deletedAt)
			)
		)
		.orderBy(asc(quoteItems.createdAt));

	return groups.map((group) => ({
		id: group.id,
		position: group.position,
		label: group.label,
		members: members
			.filter((m) => m.groupId === group.id)
			.map((m) => ({ itemId: m.itemId, quantity: m.quantity }))
	}));
}

/** Replace all groups of a quote (delete + insert). Members are real, live quote item ids. */
export async function replaceQuoteItemGroups(
	quoteId: string,
	groups: readonly ItemGroup[],
	executor: DbOrTx = db
): Promise<void> {
	await executor.delete(quoteItemGroups).where(eq(quoteItemGroups.quoteId, quoteId));

	const now = nowISO();
	let position = 0;
	for (const group of groups) {
		if (group.members.length === 0) continue;
		const groupId = crypto.randomUUID();
		await executor.insert(quoteItemGroups).values({
			id: groupId,
			quoteId,
			label: group.label,
			position: position++,
			createdAt: now,
			updatedAt: now
		});
		await executor
			.insert(quoteItemGroupMembers)
			.values(group.members.map((m) => ({ groupId, quoteItemId: m.itemId, quantity: m.quantity })));
	}
}

/** Live lines of a quote in the minimal shape the grouping helpers need. */
export async function findQuoteGroupableItems(quoteId: string, executor: DbOrTx = db) {
	return executor
		.select({
			id: quoteItems.id,
			itemType: quoteItems.itemType,
			quantity: quoteItems.quantity,
			parentId: quoteItems.parentQuoteItemId,
			snapshotName: quoteItems.snapshotName
		})
		.from(quoteItems)
		.where(and(eq(quoteItems.quoteId, quoteId), isNull(quoteItems.deletedAt)))
		.orderBy(asc(quoteItems.createdAt));
}
