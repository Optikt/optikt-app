/**
 * Change History Remote Functions
 * Server-side functions for fetching entity change history
 */
import { query } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { z } from 'zod';
import { getEntityHistory, getEntityHistoryCount } from '$lib/server/db/queries/changeHistory';
import {
	getSaleAuditHistory as getSaleAuditHistoryQuery,
	getSaleAuditHistoryCount
} from '$lib/server/db/queries/changeHistory';
import { ALL_ENTITY_TYPES } from '$lib/server/db/schema';
import type { EntityType, ActionType, ChangeRecord } from '$lib/server/db/schema';

// Schema for fetching entity history
const GetEntityHistorySchema = z.object({
	entityType: z.enum(ALL_ENTITY_TYPES),
	entityId: z.string().uuid(),
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).default(0)
});

export type GetEntityHistoryParams = z.infer<typeof GetEntityHistorySchema>;

export interface HistoryEntryResponse {
	id: string;
	action: ActionType;
	changes: ChangeRecord;
	changedAt: string;
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
		requireAuth();

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

// Schema for the sale audit timeline (sale + its payments, paged)
const GetSaleAuditHistorySchema = z.object({
	saleId: z.uuid(),
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).default(0)
});

export interface SaleAuditHistoryEntry {
	id: string;
	entityType: EntityType;
	action: ActionType;
	changes: ChangeRecord;
	changedAt: string;
	changedByName: string | null;
	reason: string | null;
}

export interface SaleAuditHistoryResponse {
	entries: SaleAuditHistoryEntry[];
	total: number;
	hasMore: boolean;
}

/**
 * Sale audit timeline: the sale's events plus its payments' (registered /
 * voided), most recent first. The detail drawer pages it with «ver más».
 */
export const getSaleAuditHistory = query(
	GetSaleAuditHistorySchema,
	async (data): Promise<SaleAuditHistoryResponse> => {
		requireAuth();

		const { saleId, limit, offset } = data;

		const [entries, total] = await Promise.all([
			getSaleAuditHistoryQuery(saleId, { limit, offset }),
			getSaleAuditHistoryCount(saleId)
		]);

		return {
			entries: entries.map((entry) => ({
				id: entry.id,
				entityType: entry.entityType as EntityType,
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
