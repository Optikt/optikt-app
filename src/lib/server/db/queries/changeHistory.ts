import { eq, and, desc, asc, inArray, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	changeHistory,
	purchaseOrderPayments,
	users,
	type EntityType,
	type ActionType,
	type ChangeHistory
} from '$lib/server/db/schema';
import type { ChangeHistoryOptions } from '$lib/server/audit';

// ============================================================================
// CHANGE HISTORY QUERIES
// ============================================================================

/**
 * Change history entry with user information
 */
export type ChangeHistoryWithUser = ChangeHistory & {
	changedByName: string | null;
};

/**
 * Get the change history for a specific entity.
 * Returns entries ordered by most recent first.
 */
export async function getEntityHistory(
	entityType: EntityType,
	entityId: string,
	options: ChangeHistoryOptions = {}
): Promise<ChangeHistoryWithUser[]> {
	const { limit = 50, offset = 0, actions } = options;

	const conditions = [
		eq(changeHistory.entityType, entityType),
		eq(changeHistory.entityId, entityId)
	];

	if (actions && actions.length > 0) {
		conditions.push(inArray(changeHistory.action, actions));
	}

	const results = await db
		.select({
			history: changeHistory,
			changedByName: users.fullName
		})
		.from(changeHistory)
		.leftJoin(users, eq(changeHistory.changedById, users.id))
		.where(and(...conditions))
		.orderBy(desc(changeHistory.changedAt))
		.limit(limit)
		.offset(offset);

	return results.map((r) => ({
		...r.history,
		changedByName: r.changedByName
	}));
}

/**
 * Get the change history count for an entity.
 */
export async function getEntityHistoryCount(
	entityType: EntityType,
	entityId: string,
	actions?: ActionType[]
): Promise<number> {
	const conditions = [
		eq(changeHistory.entityType, entityType),
		eq(changeHistory.entityId, entityId)
	];

	if (actions && actions.length > 0) {
		conditions.push(inArray(changeHistory.action, actions));
	}

	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(changeHistory)
		.where(and(...conditions));

	return result[0]?.count ?? 0;
}

/**
 * Get recent changes across all entities of a specific type.
 * Useful for admin dashboards.
 */
export async function getRecentChanges(
	entityType: EntityType,
	options: ChangeHistoryOptions = {}
): Promise<ChangeHistoryWithUser[]> {
	const { limit = 20, offset = 0, actions } = options;

	const conditions = [eq(changeHistory.entityType, entityType)];

	if (actions && actions.length > 0) {
		conditions.push(inArray(changeHistory.action, actions));
	}

	const results = await db
		.select({
			history: changeHistory,
			changedByName: users.fullName
		})
		.from(changeHistory)
		.leftJoin(users, eq(changeHistory.changedById, users.id))
		.where(and(...conditions))
		.orderBy(desc(changeHistory.changedAt))
		.limit(limit)
		.offset(offset);

	return results.map((r) => ({
		...r.history,
		changedByName: r.changedByName
	}));
}

/**
 * Get all changes made by a specific user.
 */
export async function getUserChanges(
	userId: string,
	options: ChangeHistoryOptions & { entityType?: EntityType } = {}
): Promise<ChangeHistoryWithUser[]> {
	const { limit = 50, offset = 0, actions, entityType } = options;

	const conditions = [eq(changeHistory.changedById, userId)];

	if (entityType) {
		conditions.push(eq(changeHistory.entityType, entityType));
	}

	if (actions && actions.length > 0) {
		conditions.push(inArray(changeHistory.action, actions));
	}

	const results = await db
		.select({
			history: changeHistory,
			changedByName: users.fullName
		})
		.from(changeHistory)
		.leftJoin(users, eq(changeHistory.changedById, users.id))
		.where(and(...conditions))
		.orderBy(desc(changeHistory.changedAt))
		.limit(limit)
		.offset(offset);

	return results.map((r) => ({
		...r.history,
		changedByName: r.changedByName
	}));
}

/**
 * Get a single history entry by ID.
 */
export async function findHistoryById(id: string): Promise<ChangeHistoryWithUser | null> {
	const results = await db
		.select({
			history: changeHistory,
			changedByName: users.fullName
		})
		.from(changeHistory)
		.leftJoin(users, eq(changeHistory.changedById, users.id))
		.where(eq(changeHistory.id, id))
		.limit(1);

	if (results.length === 0) return null;

	return {
		...results[0].history,
		changedByName: results[0].changedByName
	};
}

/**
 * Delete old history entries (for data retention).
 * @param olderThan - Delete entries older than this date
 * @returns Number of deleted entries
 */
export async function deleteOldHistory(olderThan: Date): Promise<number> {
	const result = await db
		.delete(changeHistory)
		.where(sql`${changeHistory.changedAt} < ${olderThan}`);

	return result.count;
}

/**
 * Get the full audit timeline for a purchase order, including events from its
 * payments. Ordered chronologically (oldest first) for display as a timeline.
 */
export async function getPurchaseOrderAuditHistory(
	purchaseOrderId: string
): Promise<ChangeHistoryWithUser[]> {
	// Sub-select: IDs of all payments belonging to this PO
	const paymentIdsSq = db
		.select({ id: purchaseOrderPayments.id })
		.from(purchaseOrderPayments)
		.where(eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId));

	const results = await db
		.select({
			history: changeHistory,
			changedByName: users.fullName
		})
		.from(changeHistory)
		.leftJoin(users, eq(changeHistory.changedById, users.id))
		.where(
			or(
				and(
					eq(changeHistory.entityType, 'purchase_order'),
					eq(changeHistory.entityId, purchaseOrderId)
				),
				and(
					eq(changeHistory.entityType, 'purchase_order_payment'),
					inArray(changeHistory.entityId, paymentIdsSq)
				)
			)
		)
		.orderBy(asc(changeHistory.changedAt));

	return results.map((r) => ({
		...r.history,
		changedByName: r.changedByName
	}));
}
