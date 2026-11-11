/**
 * Conteo Físico — remote functions (SvelteKit `$app/server`).
 * Lecturas: A/M/S · Conteo: A/M o responsable activo · Ajustes, cierre,
 * cancelación, responsables y config del ciclo: A/M.
 */
import { command, query } from '$app/server';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { inventoryCountLines } from '$lib/server/db/schema';
import {
	ClearLineAdjustmentSchema,
	RequestAdjustmentsBatchSchema,
	RequestLineAdjustmentSchema,
	CancelInventoryCountSessionSchema,
	ConfirmZeroStockSchema,
	CreateCountSessionSchema,
	GetDiffCostsSchema,
	GetSessionsSchema,
	ListCountOptionsSchema,
	PreviewCountScopeSchema,
	RecountCountLineSchema,
	SessionIdSchema,
	SetSessionResponsiblesSchema,
	UpdateCountSettingsSchema,
	UpsertCountLineSchema
} from '$lib/schemas/inventoryCount';
import type { InventoryCountScopeKind } from '$lib/schemas/inventoryCount';
import {
	applySession as applyCountSessionDb,
	cancelSession as cancelCountSessionDb,
	createSession as createCountSessionDb,
	getActiveSession as getActiveCountSessionDb,
	getCountCycleConfig,
	getSessionById as getCountSessionByIdDb,
	getSessions as getCountSessionsDb
} from '$lib/server/db/queries/inventoryCount/sessions';
import {
	confirmZeroStockBatch,
	recountCountLine,
	upsertCountLine
} from '$lib/server/db/queries/inventoryCount/lines';
import {
	clearLineAdjustmentRequest,
	requestAdjustmentsBatch,
	requestCountLineAdjustment
} from '$lib/server/db/queries/inventoryCount/adjustments';
import {
	getCoverage,
	previewScope,
	type CoverageOptionRow,
	type CoverageData
} from '$lib/server/db/queries/inventoryCount/coverage';
import { buildLineCostMap } from '$lib/server/db/queries/inventoryCount/costs';
import {
	listResponsibleOptions,
	requireWriteAccess,
	syncSessionResponsibles
} from '$lib/server/db/queries/inventoryCount/responsibles';
import { isAdminRole } from '$lib/server/db/queries/inventoryCount/shared';
import { updateSettings } from '$lib/server/db/queries/settings';
import { requireRole } from '$lib/server/guards';
import { UserRole, AdjustmentReason } from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';

function kindFor(data: {
	dim: string;
	quick?: 'OLDEST' | 'NEVER' | null;
}): InventoryCountScopeKind {
	if (data.quick === 'OLDEST') return 'QUICK_OLDEST';
	if (data.quick === 'NEVER') return 'QUICK_NEVER';
	return data.dim as InventoryCountScopeKind;
}

/** El enum del repo y el literal del Zod comparten valores; se mapea explícito. */
function mapReason(
	reason: 'OTHER' | 'PHYSICAL_COUNT' | 'DAMAGE' | 'SAMPLE' | 'CUSTOMER_RETURN' | 'ENTRY_ERROR'
): AdjustmentReason {
	const table: Record<string, AdjustmentReason> = {
		PHYSICAL_COUNT: AdjustmentReason.PHYSICAL_COUNT,
		DAMAGE: AdjustmentReason.DAMAGE,
		SAMPLE: AdjustmentReason.SAMPLE,
		CUSTOMER_RETURN: AdjustmentReason.CUSTOMER_RETURN,
		ENTRY_ERROR: AdjustmentReason.ENTRY_ERROR,
		OTHER: AdjustmentReason.OTHER
	};
	return table[reason] ?? AdjustmentReason.PHYSICAL_COUNT;
}

async function sessionIdForLine(lineId: number): Promise<number> {
	const [row] = await db
		.select({ sessionId: inventoryCountLines.sessionId })
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.id, lineId))
		.limit(1);
	if (!row) throw new Error('La línea de conteo no existe');
	return row.sessionId;
}

function ok<T>(data: T): { success: true; data: T } {
	return { success: true, data };
}

function fail(error: unknown): { success: false; error: string } {
	return { success: false, error: getErrorMessage(error) };
}

/** Regla de conteo: ADMIN/MANAGER siempre; un SELLER solo si es responsable activo. */
async function requireCountWriteAccess(
	userId: string,
	role: string,
	sessionId: number
): Promise<void> {
	if (isAdminRole(role)) return;
	await requireWriteAccess(sessionId, userId, false);
}

// ── Lecturas ───────────────────────────────────────────────────────────────

export const getActiveSession = query((async () => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return getActiveCountSessionDb();
}) as () => ReturnType<typeof getActiveCountSessionDb>);

export const getSessions = query(GetSessionsSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return getCountSessionsDb(data);
});

export const getSessionById = query(SessionIdSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return getCountSessionByIdDb(data.id);
});

/** Config del ciclo (settings singleton). */
export const getCountConfig = query((async () => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return getCountCycleConfig();
}) as () => ReturnType<typeof getCountCycleConfig>);

/** Cobertura: resumen del ciclo + grupos por dimensión + opciones de combobox. */
export const getCoverageData = query((async () => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	const config = await getCountCycleConfig();
	return getCoverage(config.cycleDays);
}) as () => Promise<CoverageData>);

export const listCountOptions = query(
	ListCountOptionsSchema,
	async (data): Promise<CoverageOptionRow[]> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
		const coverage = await getCoverage((await getCountCycleConfig()).cycleDays);
		return coverage.options[data.dim];
	}
);

export const previewCountScope = query(PreviewCountScopeSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	const config = await getCountCycleConfig();
	return previewScope(
		{
			kind: data.quick ? (data.quick === 'OLDEST' ? 'QUICK_OLDEST' : 'QUICK_NEVER') : kindFor(data),
			dim: data.dim,
			values: data.values,
			n: data.n ?? null
		},
		config
	);
});

/** Opciones de responsables (usuarios del sistema) — solo A/M. */
export const listCountResponsibles = query((async () => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER);
	return listResponsibleOptions();
}) as () => ReturnType<typeof listResponsibleOptions>);

/** Costo FIFO por línea con diferencia (orden Revisar por impacto). Solo A/M. */
export const getDiffCosts = query(GetDiffCostsSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER);
	const lines = await db
		.select()
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.sessionId, data.sessionId));
	const map = await buildLineCostMap(lines);
	const record: Record<string, number | null> = {};
	for (const [lineId, cost] of map) record[String(lineId)] = cost;
	return record;
});

// ── Escrituras ─────────────────────────────────────────────────────────────

export const createSessionCmd = command(CreateCountSessionSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	try {
		const session = await createCountSessionDb({
			scopeKind: kindFor(data),
			scopeDim: data.dim,
			scopeValues: data.values,
			scopeN: data.n ?? null,
			notes: data.notes ?? null,
			openedById: user.id,
			responsibles: data.responsibles.map((entry) => ({
				userId: entry.userId ?? null,
				displayName: entry.displayName,
				isExternal: entry.isExternal
			}))
		});
		return ok(session);
	} catch (error) {
		return fail(error);
	}
});

export const upsertCountLineCmd = command(UpsertCountLineSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	try {
		const sessionId = await sessionIdForLine(data.lineId);
		await requireCountWriteAccess(user.id, user.role, sessionId);
		const line = await upsertCountLine({
			lineId: data.lineId,
			countedStock: data.countedStock,
			notes: data.notes ?? null,
			userId: user.id
		});
		return ok(line);
	} catch (error) {
		return fail(error);
	}
});

export const recountCountLineCmd = command(RecountCountLineSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const sessionId = await sessionIdForLine(data.lineId);
		await requireCountWriteAccess(user.id, user.role, sessionId);
		const line = await recountCountLine({
			lineId: data.lineId,
			recountedStock: data.recountedStock,
			userId: user.id
		});
		return ok(line);
	} catch (error) {
		return fail(error);
	}
});

export const confirmZeroStock = command(ConfirmZeroStockSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	try {
		await requireCountWriteAccess(user.id, user.role, data.sessionId);
		const updated = await confirmZeroStockBatch(data.sessionId, user.id);
		return ok(updated);
	} catch (error) {
		return fail(error);
	}
});

export const requestLineAdjustmentCmd = command(RequestLineAdjustmentSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const sessionId = await sessionIdForLine(data.lineId);
		await requireCountWriteAccess(user.id, user.role, sessionId);
		const line = await requestCountLineAdjustment({
			lineId: data.lineId,
			reason: mapReason(data.reason),
			reasonText: data.reasonText ?? null,
			userId: user.id
		});
		return ok(line);
	} catch (error) {
		return fail(error);
	}
});

export const requestAdjustmentsBatchCmd = command(RequestAdjustmentsBatchSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		await requireCountWriteAccess(user.id, user.role, data.sessionId);
		const applied = await requestAdjustmentsBatch(
			data.sessionId,
			mapReason(data.reason),
			data.reasonText ?? null,
			user.id
		);
		return ok(applied);
	} catch (error) {
		return fail(error);
	}
});

export const clearLineAdjustmentCmd = command(ClearLineAdjustmentSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const sessionId = await sessionIdForLine(data.lineId);
		await requireCountWriteAccess(user.id, user.role, sessionId);
		const line = await clearLineAdjustmentRequest(data.lineId);
		return ok(line);
	} catch (error) {
		return fail(error);
	}
});

export const setSessionResponsibles = command(SetSessionResponsiblesSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const rows = await syncSessionResponsibles(data.sessionId, data.entries, user.id);
		return ok(rows);
	} catch (error) {
		return fail(error);
	}
});

export const cancelSessionCmd = command(CancelInventoryCountSessionSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const session = await cancelCountSessionDb(data.id, user.id, data.reason);
		return ok(session);
	} catch (error) {
		return fail(error);
	}
});

export const applySessionCmd = command(SessionIdSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const session = await applyCountSessionDb(data.id, user.id);
		return ok(session);
	} catch (error) {
		return fail(error);
	}
});

export const updateCountSettings = command(UpdateCountSettingsSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER);
	try {
		const settings = await updateSettings({
			countCycleDays: data.cycleDays,
			countDiffThresholdUnits: data.diffThresholdUnits,
			countDiffThresholdUsd: data.diffThresholdUsd,
			countQuickOldestLimit: data.quickOldestLimit
		});
		return ok({
			cycleDays: settings.countCycleDays,
			diffThresholdUnits: settings.countDiffThresholdUnits,
			diffThresholdUsd: settings.countDiffThresholdUsd,
			quickOldestLimit: settings.countQuickOldestLimit
		});
	} catch (error) {
		return fail(error);
	}
});
