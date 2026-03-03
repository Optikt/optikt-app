import { db } from '$lib/server/db';
import { getRequestEvent } from '$app/server';
import {
	changeHistory,
	type EntityType,
	type ActionType,
	type ChangeRecord,
	type NewChangeHistory
} from '$lib/server/db/schema';
import type { AuditContext } from './types';
import {
	calculateDiff,
	createChangeRecordForCreate,
	createChangeRecordForDelete,
	hasChanges
} from './utils';

// ============================================================================
// AUDIT SERVICE
// ============================================================================

/**
 * Audit Context Helper
 * Build audit context from the current request event.
 * Used by remote functions to capture who made the change.
 */
export function getAuditContext(): AuditContext {
	const event = getRequestEvent();
	return {
		userId: event.locals.user?.id ?? null,
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

/**
 * Service for logging entity changes to the change_history table.
 *
 * Usage:
 * ```typescript
 * import { auditService } from '$lib/server/audit';
 *
 * // In your update function:
 * const oldProduct = await findProductById(id);
 * const newProduct = await db.update(...).returning();
 * await auditService.logUpdate('product', id, oldProduct, newProduct, context);
 * ```
 */
export const auditService = {
	/**
	 * Log a create action.
	 * Records all non-null fields of the new entity.
	 */
	async logCreate<T extends Record<string, unknown>>(
		entityType: EntityType,
		entity: T & { id: string },
		context: AuditContext,
		options?: { excludeFields?: string[]; includeSnapshot?: boolean }
	): Promise<void> {
		const changes = createChangeRecordForCreate(entity, options?.excludeFields);

		if (!hasChanges(changes)) return;

		await insertChangeHistory({
			entityType,
			entityId: entity.id,
			action: 'create',
			changes,
			snapshot: options?.includeSnapshot ? (entity as Record<string, unknown>) : null,
			context
		});
	},

	/**
	 * Log an update action.
	 * Automatically calculates the diff between old and new entity states.
	 */
	async logUpdate<T extends Record<string, unknown>>(
		entityType: EntityType,
		entityId: string,
		oldEntity: T,
		newEntity: T,
		context: AuditContext,
		options?: { excludeFields?: string[]; includeSnapshot?: boolean }
	): Promise<void> {
		const changes = calculateDiff(oldEntity, newEntity, options?.excludeFields);

		// Don't log if nothing changed
		if (!hasChanges(changes)) return;

		await insertChangeHistory({
			entityType,
			entityId,
			action: 'update',
			changes,
			snapshot: options?.includeSnapshot ? (oldEntity as Record<string, unknown>) : null,
			context
		});
	},

	/**
	 * Log a delete action.
	 * Records the entity state before deletion.
	 */
	async logDelete<T extends Record<string, unknown>>(
		entityType: EntityType,
		entity: T & { id: string },
		context: AuditContext,
		options?: { excludeFields?: string[] }
	): Promise<void> {
		const changes = createChangeRecordForDelete(entity, options?.excludeFields);

		await insertChangeHistory({
			entityType,
			entityId: entity.id,
			action: 'delete',
			changes,
			snapshot: entity as Record<string, unknown>,
			context
		});
	},

	/**
	 * Log a restore action (un-delete).
	 * Records that the entity was restored.
	 */
	async logRestore<T extends Record<string, unknown>>(
		entityType: EntityType,
		entity: T & { id: string },
		context: AuditContext
	): Promise<void> {
		await insertChangeHistory({
			entityType,
			entityId: entity.id,
			action: 'restore',
			changes: { restored: { old: false, new: true } },
			snapshot: entity as Record<string, unknown>,
			context
		});
	},

	/**
	 * Log a custom change with pre-calculated changes.
	 * Useful when you need more control over what's logged.
	 */
	async logCustom(
		entityType: EntityType,
		entityId: string,
		action: ActionType,
		changes: ChangeRecord,
		context: AuditContext,
		snapshot?: Record<string, unknown>
	): Promise<void> {
		await insertChangeHistory({
			entityType,
			entityId,
			action,
			changes,
			snapshot: snapshot ?? null,
			context
		});
	}
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface InsertParams {
	entityType: EntityType;
	entityId: string;
	action: ActionType;
	changes: ChangeRecord;
	snapshot: Record<string, unknown> | null;
	context: AuditContext;
}

async function insertChangeHistory(params: InsertParams): Promise<void> {
	const { entityType, entityId, action, changes, snapshot, context } = params;

	const record: NewChangeHistory = {
		entityType,
		entityId,
		action,
		changedAt: new Date(),
		changedById: context.userId ?? null,
		changes,
		snapshot,
		reason: context.reason ?? null,
		ipAddress: context.ipAddress ?? null,
		userAgent: context.userAgent ? context.userAgent.slice(0, 255) : null
	};

	await db.insert(changeHistory).values(record);
}
