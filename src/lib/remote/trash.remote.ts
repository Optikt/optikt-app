/**
 * Trash Remote Functions
 * Unified soft-delete registry: list + restore trashed master-data records.
 */
import { command, query } from '$app/server';
import { z } from 'zod';
import { EmptySchema } from '#lib/schemas/common/dates.js';
import { requireUserAdmin } from '#lib/server/guards.js';
import { db } from '#lib/server/db/index.js';
import { listTrash, restore, trashLabel } from '#lib/server/db/queries/deletedItems.js';
import type { DeletedEntityType } from '#lib/server/db/schema/index.js';

/** List all trashed records (newest first), with a human-readable label. */
export const listTrashCmd = query(EmptySchema, async () => {
	requireUserAdmin();
	const items = await listTrash();
	return items.map((item) => ({ ...item, label: trashLabel(item) }));
});

const RestoreItemSchema = z.object({
	entityType: z.string().min(1),
	entityId: z.uuid()
});

/** Restore a trashed record (clears deleted_at and removes its registry row). */
export const restoreItemCmd = command(RestoreItemSchema, async (data) => {
	requireUserAdmin();

	await db.transaction(async (tx) => {
		const ok = await restore(data.entityType as DeletedEntityType, data.entityId, tx);
		if (!ok) throw new Error('Elemento no encontrado en la papelera');
	});

	return { success: true };
});
