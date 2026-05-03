import { command, query } from '$app/server';
import {
	CancelInventoryCountSessionSchema,
	CreateInventoryCountSessionSchema,
	GetSessionLinesSchema,
	GetSessionsSchema,
	SetInventoryCountLineAdjustmentStatusSchema,
	SessionIdSchema,
	UpsertInventoryCountLineSchema
} from '$lib/schemas/inventoryCount';
import {
	applySession as applyInventoryCountSession,
	cancelSession as cancelInventoryCountSession,
	createSession as createInventoryCountSession,
	getActiveSession as getActiveInventoryCountSession,
	getSessionById as getInventoryCountSessionById,
	getSessionLines as getInventoryCountSessionLines,
	getSessions as getInventoryCountSessions,
	setLineAdjustmentStatus as updateInventoryCountLineAdjustmentStatus,
	upsertCountLine as saveInventoryCountLine,
	type InventoryCountSessionDetail,
	type InventoryCountSessionSummary,
	type InventoryCountLineRow
} from '$lib/server/db/queries/inventoryCount';
import { requireRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';

export const getActiveSession = query((async () => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return getActiveInventoryCountSession();
}) as () => Promise<InventoryCountSessionSummary | null>);

export const getSessions = query(
	GetSessionsSchema,
	async (data): Promise<InventoryCountSessionSummary[]> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
		return getInventoryCountSessions(data.limit);
	}
);

export const getSessionById = query(
	SessionIdSchema,
	async (data): Promise<InventoryCountSessionDetail | null> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
		return getInventoryCountSessionById(data.id);
	}
);

export const getSessionLines = query(
	GetSessionLinesSchema,
	async (data): Promise<InventoryCountLineRow[]> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
		return getInventoryCountSessionLines(data.sessionId, data.filter);
	}
);

export const createSession = command(CreateInventoryCountSessionSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	try {
		const session = await createInventoryCountSession({
			...data,
			scopeValue: data.scopeValue ?? null,
			notes: data.notes ?? null,
			openedById: user.id
		});

		return { success: true as const, session };
	} catch (error) {
		console.error('Error creating inventory count session:', error);
		return { success: false as const, error: getErrorMessage(error) };
	}
});

export const upsertCountLine = command(UpsertInventoryCountLineSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	try {
		const line = await saveInventoryCountLine({
			...data,
			notes: data.notes ?? null,
			userId: user.id
		});

		return { success: true as const, line };
	} catch (error) {
		console.error('Error saving inventory count line:', error);
		return { success: false as const, error: getErrorMessage(error) };
	}
});

export const setLineAdjustmentStatus = command(
	SetInventoryCountLineAdjustmentStatusSchema,
	async (data) => {
		const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

		try {
			const line = await updateInventoryCountLineAdjustmentStatus({
				...data,
				userId: user.id
			});

			return { success: true as const, line };
		} catch (error) {
			console.error('Error updating inventory count adjustment status:', error);
			return { success: false as const, error: getErrorMessage(error) };
		}
	}
);

export const applySession = command(SessionIdSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);

	try {
		const session = await applyInventoryCountSession(data.id, user.id);
		return { success: true as const, session };
	} catch (error) {
		console.error('Error applying inventory count session:', error);
		return { success: false as const, error: getErrorMessage(error) };
	}
});

export const cancelSession = command(CancelInventoryCountSessionSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);

	try {
		const session = await cancelInventoryCountSession(data.id, user.id, data.reason);
		return { success: true as const, session };
	} catch (error) {
		console.error('Error cancelling inventory count session:', error);
		return { success: false as const, error: getErrorMessage(error) };
	}
});
