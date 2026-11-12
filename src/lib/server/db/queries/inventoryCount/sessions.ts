/**
 * Conteo Físico — ciclo de vida de sesiones: lista, detalle, creación con
 * alcance estructurado, cancelación y cierre con la nueva regla (stock 0 no
 * bloquea; recuentos obligatorios sobre el umbral; cobertura antes→después).
 */
import { and, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { getSettings } from '$lib/server/db/queries/settings';
import { type NewInventoryCountResponsible } from '$lib/server/db/schema';
import {
	inventoryCountLines,
	inventoryCountResponsibles,
	inventoryCountSessions,
	lensCatalogItems,
	products,
	users,
	type InventoryCountSession
} from '$lib/server/db/schema';
import {
	DEFAULT_COUNT_CONFIG,
	summarizeCoverage,
	type CountCycleConfig
} from '$lib/shared/inventoryCount';
import { executeCountLineAdjustment } from './adjustments';
import type {
	CreateCountSessionInput,
	CountSessionSummary,
	GetSessionsOptions,
	InventoryCountSessionDetail
} from './types';
import type { ScopeSelection } from './types';
import {
	createSnapshotLines,
	enrichSessions,
	requireOpenSession,
	normalizeSessionNotes,
	isAdminRole
} from './shared';
import { coverageSummaryLite, selectCoverageItems } from './coverage';
import { listSessionResponsibles } from './responsibles';
import { getSessionLines } from './lines';
import { buildLineCostMap, persistFrozenCosts } from './costs';

// ── Configuración del ciclo (settings singleton) ───────────────────────────

export async function getCountCycleConfig(): Promise<CountCycleConfig> {
	try {
		const settings = await getSettings();
		return {
			cycleDays: settings.countCycleDays ?? DEFAULT_COUNT_CONFIG.cycleDays,
			diffThresholdUnits:
				settings.countDiffThresholdUnits ?? DEFAULT_COUNT_CONFIG.diffThresholdUnits,
			diffThresholdUsd: settings.countDiffThresholdUsd ?? DEFAULT_COUNT_CONFIG.diffThresholdUsd,
			quickOldestLimit: settings.countQuickOldestLimit ?? DEFAULT_COUNT_CONFIG.quickOldestLimit
		};
	} catch {
		return DEFAULT_COUNT_CONFIG;
	}
}

// ── Lecturas ───────────────────────────────────────────────────────────────

export async function getActiveSession(executor: DbOrTx = db): Promise<CountSessionSummary | null> {
	const session = await getActiveSessionRow(executor);
	if (!session) return null;
	const [enriched] = await enrichSessions([session], executor);
	return enriched ?? null;
}

export async function getSessions(
	options: GetSessionsOptions = {},
	executor: DbOrTx = db
): Promise<CountSessionSummary[]> {
	const { limit = 20, status, openedOn } = options;
	const conditions: SQL[] = [];
	if (status) conditions.push(eq(inventoryCountSessions.status, status));
	if (openedOn) {
		const from = new Date(`${openedOn}T00:00:00.000Z`);
		const to = new Date(`${openedOn}T23:59:59.999Z`);
		if (!Number.isNaN(from.getTime())) {
			conditions.push(gte(inventoryCountSessions.openedAt, from.toISOString()));
			conditions.push(lte(inventoryCountSessions.openedAt, to.toISOString()));
		}
	}

	const base = executor
		.select()
		.from(inventoryCountSessions)
		.orderBy(desc(inventoryCountSessions.openedAt))
		.limit(limit);

	const sessions = conditions.length ? await base.where(and(...conditions)) : await base;
	return enrichSessions(sessions, executor);
}

export async function getSessionById(
	id: number,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail | null> {
	const session = await getSessionRow(id, executor);
	if (!session) return null;

	const [[enriched], lines, responsibles] = await Promise.all([
		enrichSessions([session], executor),
		getSessionLines(id, 'ALL', executor),
		listSessionResponsibles(id, executor)
	]);

	if (!enriched) return null;
	return { ...enriched, responsibles, lines };
}

// ── Crear sesión ───────────────────────────────────────────────────────────

export async function createSession(
	data: CreateCountSessionInput,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail> {
	if (executor === db) {
		return db.transaction((tx) => createSession(data, tx));
	}

	const existing = await getActiveSessionRow(executor);
	if (existing) throw new Error('Ya existe una sesión de conteo abierta');

	const scope: ScopeSelection = {
		kind: data.scopeKind,
		dim: data.scopeDim,
		values: data.scopeValues,
		n: data.scopeN
	};

	const config = await getCountCycleConfig();
	// coverageBefore solo necesita el resumen: getCoverage completo (agrupados +
	// opciones + COUNT por fila) costaba ~3 s en DB remota para obtener 2 números.
	const coverage = await coverageSummaryLite(config.cycleDays, executor);
	const now = new Date().toISOString();

	const [session] = await executor
		.insert(inventoryCountSessions)
		.values({
			status: 'OPEN',
			scopeType: 'ALL',
			scopeValue: null,
			scopeKind: data.scopeKind,
			scopeDim: data.scopeDim,
			scopeValues: data.scopeValues,
			scopeN: data.scopeN,
			notes: normalizeSessionNotes(data.notes),
			openedById: data.openedById,
			coverageBefore: coverage.verifiedPercent,
			coverageNeverBefore: coverage.neverCounted,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	// Snapshot del alcance (lanza si no hay ítems elegibles → rollback completo).
	await createSnapshotLines(session.id, scope, executor);

	// Responsables: el creador queda activo por defecto + los del panel.
	const [creatorRow] = await executor
		.select({ fullName: users.fullName })
		.from(users)
		.where(eq(users.id, data.openedById))
		.limit(1);
	const openedRow = {
		sessionId: session.id,
		userId: data.openedById,
		displayName: creatorRow?.fullName ?? 'Usuario',
		isExternal: false,
		addedById: data.openedById,
		addedAt: now,
		createdAt: now,
		updatedAt: now
	};
	const rows: Array<NewInventoryCountResponsible> = [openedRow];
	const seenUsers = new Set<string>([data.openedById]);
	for (const entry of data.responsibles) {
		if (entry.userId && seenUsers.has(entry.userId)) continue;
		if (entry.userId) seenUsers.add(entry.userId);
		rows.push({
			sessionId: session.id,
			userId: entry.userId ?? null,
			displayName: entry.displayName,
			isExternal: entry.isExternal,
			addedById: data.openedById,
			addedAt: now,
			createdAt: now,
			updatedAt: now
		});
	}
	await executor.insert(inventoryCountResponsibles).values(rows);

	const detail = await getSessionById(session.id, executor);
	if (!detail) throw new Error('No se pudo cargar la sesión recién creada');
	return detail;
}

// ── Cancelar y cerrar ──────────────────────────────────────────────────────

export async function cancelSession(
	id: number,
	userId: string,
	reason: string,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail> {
	if (executor === db) {
		return db.transaction((tx) => cancelSession(id, userId, reason, tx));
	}
	const session = await getSessionRow(id, executor, { lock: true });
	requireOpenSession(session);

	const cancelReason = reason.trim();
	if (!cancelReason) throw new Error('Debes indicar el motivo de cancelación');

	// Congela el costo FIFO también al cancelar (aquí nunca se ejecutan
	// ajustes, así que los lotes están intactos y el costo es fiel).
	const cancelLines = await executor
		.select()
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.sessionId, id));
	const cancelCosts = await buildLineCostMap(cancelLines, executor);
	await persistFrozenCosts(
		[...cancelCosts].filter((entry): entry is [number, number] => entry[1] != null),
		executor
	);

	const now = new Date().toISOString();
	await executor
		.update(inventoryCountSessions)
		.set({
			status: 'CANCELLED',
			cancelledById: userId,
			cancelledAt: now,
			cancelReason,
			updatedAt: now
		})
		.where(eq(inventoryCountSessions.id, id));

	const updated = await getSessionById(id, executor);
	if (!updated) throw new Error('No se pudo cargar la sesión cancelada');
	return updated;
}

/**
 * Cierre (rediseño):
 * - permitido cuando todas las líneas con `systemStock > 0` están contadas, y
 * - toda diferencia «grave» (≥ umbral en unidades o USD) fue recontada;
 * - stock 0 sin confirmar no bloquea (y no deja verificación).
 * Al cerrar: totales, `lastCountedAt` en los verificados y cobertura antes→después.
 */
export async function applySession(
	id: number,
	userId: string,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail> {
	if (executor === db) {
		return db.transaction((tx) => applySession(id, userId, tx));
	}

	const [actor] = await executor
		.select({ id: users.id, role: users.role })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!actor) throw new Error('Usuario no encontrado');
	if (!isAdminRole(actor.role)) {
		throw new Error('Solo ADMIN o MANAGER pueden cerrar la sesión');
	}

	// Bloquea la sesión ANTES de leer las líneas: serializa con quien solicite
	// o quite ajustes mientras se cierra (evita solicitudes huérfanas post-cierre).
	const session = await getSessionRow(id, executor, { lock: true });
	requireOpenSession(session);

	const [lines, config] = await Promise.all([
		executor.select().from(inventoryCountLines).where(eq(inventoryCountLines.sessionId, id)),
		getCountCycleConfig()
	]);

	const pendingCounting = lines.filter((line) => line.countedStock == null && line.systemStock > 0);
	if (pendingCounting.length > 0) {
		throw new Error(
			`Debes contar ${pendingCounting.length} ítem(s) con stock antes de cerrar la sesión`
		);
	}

	const costByLineId = await buildLineCostMap(lines, executor);
	// Congela el costo FIFO por línea ANTES de ejecutar ajustes: el informe del
	// cierre no depende del stock vivo (un ajuste a 0 drena el lote y el costo
	// vivo sería null/otro — spec: «los datos del informe cerrado son estables»).
	await persistFrozenCosts(
		[...costByLineId].filter((entry): entry is [number, number] => entry[1] != null),
		executor
	);

	const recountPending = lines.filter((line) => {
		if (line.recountedStock != null) return false;
		const final = line.countedStock ?? 0;
		const diff = final - line.systemStock;
		if (diff === 0) return false;
		const cost = costByLineId.get(line.id) ?? null;
		const unitsExceeded = Math.abs(diff) >= config.diffThresholdUnits;
		const usdExceeded =
			config.diffThresholdUsd > 0 &&
			cost != null &&
			Math.abs(diff * cost) >= config.diffThresholdUsd;
		return unitsExceeded || usdExceeded;
	});
	if (recountPending.length > 0) {
		throw new Error(
			`Hay ${recountPending.length} diferencia(s) sobre el umbral que deben recontarse`
		);
	}

	// Ajustes solicitados en Revisar: aquí se crean los movimientos, dentro de
	// esta misma transacción. Si alguno falla, todo revierte y la sesión sigue
	// OPEN (nunca queda stock movido por un conteo que no se aplicó).
	const requestedAdjustments = lines.filter(
		(line) => line.adjustmentRequestedAt != null && line.adjustmentMovementId == null
	);
	for (const line of requestedAdjustments) {
		await executeCountLineAdjustment(line, userId, executor);
	}

	const coveredNow = new Date().toISOString();
	const verified = lines.filter((line) => line.countedStock != null);

	// Fijar lastCountedAt para los ítems verificados (productos y lentes).
	const verifiedProductIds = verified
		.filter((line) => line.itemType === 'PRODUCT' && line.productId != null)
		.map((line) => line.productId as string);
	const verifiedLensIds = verified
		.filter((line) => line.itemType === 'LENS' && line.lensCatalogItemId != null)
		.map((line) => line.lensCatalogItemId as string);

	if (verifiedProductIds.length > 0) {
		await executor
			.update(products)
			.set({ lastCountedAt: coveredNow, lastCountSessionId: id })
			.where(inArray(products.id, verifiedProductIds));
	}
	if (verifiedLensIds.length > 0) {
		await executor
			.update(lensCatalogItems)
			.set({ lastCountedAt: coveredNow, lastCountSessionId: id })
			.where(inArray(lensCatalogItems.id, verifiedLensIds));
	}

	const finalCount = (line: InventoryCountSessionLineSeed): number =>
		line.recountedStock ?? line.countedStock ?? 0;
	const finalDiff = (line: InventoryCountSessionLineSeed): number =>
		finalCount(line) - line.systemStock;

	const countedLines = lines.filter((line) => line.countedStock != null);
	const totalAdjustmentsIn = countedLines.filter((line) => finalDiff(line) > 0).length;
	const totalAdjustmentsOut = countedLines.filter((line) => finalDiff(line) < 0).length;
	const totalMatches = countedLines.filter((line) => finalDiff(line) === 0).length;

	// Cobertura después del cierre: los ítems verificados pasan a edad 0.
	const items = await selectCoverageItems(executor);
	const verifiedItemIds = new Set<string>();
	for (const line of verified) {
		if (line.productId) verifiedItemIds.add(line.productId);
		if (line.lensCatalogItemId) verifiedItemIds.add(line.lensCatalogItemId);
	}
	const after = summarizeCoverage(
		items.map(
			(item: {
				lastCountedAt: string | null;
				createdAt: string | null;
				productId: string | null;
				lensCatalogItemId: string | null;
			}) => ({
				lastCountedAt: verifiedItemIds.has(item.productId ?? item.lensCatalogItemId ?? '—')
					? coveredNow
					: item.lastCountedAt,
				createdAt: item.createdAt
			})
		),
		config.cycleDays
	);

	await executor
		.update(inventoryCountSessions)
		.set({
			status: 'APPLIED',
			appliedById: userId,
			appliedAt: coveredNow,
			coverageAfter: after.verifiedPercent,
			coverageNeverAfter: after.neverCounted,
			totalItemsCounted: countedLines.length,
			totalAdjustmentsIn,
			totalAdjustmentsOut,
			totalMatches,
			updatedAt: coveredNow
		})
		.where(eq(inventoryCountSessions.id, id));

	const updated = await getSessionById(id, executor);
	if (!updated) throw new Error('No se pudo cargar la sesión aplicada');
	return updated;
}

interface InventoryCountSessionLineSeed {
	recountedStock: number | null;
	countedStock: number | null;
	systemStock: number;
}

// ── Row helpers ─────────────────────────────────────────────────────────────

export async function getSessionRow(
	id: number,
	executor: DbOrTx = db,
	options: { lock?: boolean } = {}
): Promise<InventoryCountSession | null> {
	const base = executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, id));
	// `lock`: FOR UPDATE serializa pedido/quitar/cancelar/cerrar sobre la misma
	// sesión (cierre vs. ajustes concurrentes); sin lock es solo lectura.
	const [session] = options.lock ? await base.limit(1).for('update') : await base.limit(1);
	return session ?? null;
}

export async function getActiveSessionRow(
	executor: DbOrTx = db
): Promise<InventoryCountSession | null> {
	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.status, 'OPEN'))
		.orderBy(desc(inventoryCountSessions.openedAt))
		.limit(1);
	return session ?? null;
}
