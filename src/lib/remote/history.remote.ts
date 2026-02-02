/**
 * Change History Remote Functions
 * Server-side functions for fetching entity change history
 */
import { query } from '$app/server';
import * as v from 'valibot';
import { getEntityHistory, getEntityHistoryCount } from '$lib/server/db/queries/changeHistory';
import type { EntityType, ActionType, ChangeRecord } from '$lib/server/db/schema';

// Schema for fetching entity history
const GetEntityHistorySchema = v.object({
	entityType: v.picklist([
		'product',
		'customer',
		'prescription',
		'sale',
		'sale_item',
		'lens_catalog_item',
		'supplier',
		'brand',
		'material',
		'lens_material',
		'lens_treatment'
	]),
	entityId: v.pipe(v.string(), v.uuid()),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 50),
	offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0)
});

export type GetEntityHistoryParams = v.InferInput<typeof GetEntityHistorySchema>;

export interface HistoryEntryResponse {
	id: string;
	action: ActionType;
	changes: ChangeRecord;
	changedAt: Date;
	changedByName: string | null;
	reason: string | null;
}

export interface EntityHistoryResponse {
	entries: HistoryEntryResponse[];
	total: number;
	hasMore: boolean;
}

/**
 * Fetch change history for a specific entity
 */
export const getHistory = query(
	GetEntityHistorySchema,
	async (data): Promise<EntityHistoryResponse> => {
		const { entityType, entityId, limit, offset } = data;

		const [entries, total] = await Promise.all([
			getEntityHistory(entityType as EntityType, entityId, { limit, offset }),
			getEntityHistoryCount(entityType as EntityType, entityId)
		]);

		return {
			entries: entries.map((entry) => ({
				id: entry.id,
				action: entry.action as ActionType,
				changes: entry.changes,
				changedAt: entry.changedAt,
				changedByName: entry.changedByName,
				reason: entry.reason
			})),
			total,
			hasMore: offset + entries.length < total
		};
	}
);
