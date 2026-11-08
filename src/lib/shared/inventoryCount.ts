/**
 * Shared (client + server) logic for Conteo Físico: cycle/traffic-light math,
 * difference classification, closure rules and formatting helpers.
 * Must not import server-only modules.
 */

import type {
	InventoryCountScopeDim,
	InventoryCountScopeKind,
	InventoryCountSessionStatus,
	InventoryCountUiFilter
} from '$lib/schemas/inventoryCount';

// ── Config del ciclo ────────────────────────────────────────────────────────

export interface CountCycleConfig {
	/** Plazo del ciclo en días (setup «Ajustes del ciclo»). */
	cycleDays: number;
	/** Umbral de diferencia en unidades. */
	diffThresholdUnits: number;
	/**
	 * Umbral de diferencia en USD (0 = desactivado). Una diferencia complica si
	 * |dif| ≥ unidades o |dif × costo| ≥ usd.
	 */
	diffThresholdUsd: number;
	/** N del atajo «los más atrasados». */
	quickOldestLimit: number;
}

export const DEFAULT_COUNT_CONFIG: CountCycleConfig = {
	cycleDays: 30,
	diffThresholdUnits: 2,
	diffThresholdUsd: 0,
	quickOldestLimit: 50
};

/** Fracción del plazo en la que un ítem pasa de «al día» a «por vencer». */
export const CYCLE_SOON_RATIO = 0.75;

// ── Formateo básico ─────────────────────────────────────────────────────────

export function daysSince(
	iso: string | null | undefined,
	nowMs: number = Date.now()
): number | null {
	if (!iso) return null;
	const time = new Date(iso).getTime();
	if (Number.isNaN(time)) return null;
	return Math.max(0, Math.floor((nowMs - time) / 86_400_000));
}

export function medianOf(values: number[]): number | null {
	const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
	if (list.length === 0) return null;
	const mid = list.length >> 1;
	return list.length % 2 === 0 ? Math.round((list[mid - 1]! + list[mid]!) / 2) : list[mid]!;
}

export function formatAgo(ageDays: number | null): string {
	if (ageDays == null) return 'nunca';
	if (ageDays < 1) return 'hoy';
	return `hace ${ageDays} d`;
}

export function formatSignedInteger(value: number | null): string {
	if (value == null || value === 0) return '—';
	if (value > 0) return `+${value}`;
	return `${value}`;
}

export function formatUsd(value: number): string {
	const sign = value < 0 ? '−$' : '$';
	return `${sign}${Math.abs(value).toLocaleString('es', { maximumFractionDigits: 2 })}`;
}

// ── Semáforo de cobertura ───────────────────────────────────────────────────

export type TrafficState = 'ok' | 'soon' | 'over' | 'none';

export const TRAFFIC_STATE_LABELS: Record<TrafficState, string> = {
	ok: 'Al día',
	soon: 'Por vencer',
	over: 'Vencido',
	none: 'Nunca contado'
};

export const TRAFFIC_STATE_HINTS: Record<TrafficState, string> = {
	ok: 'Contado dentro del 75 % del plazo.',
	soon: 'Entre el 75 % y el 100 % del plazo.',
	over: 'Superó el plazo del ciclo.',
	none: 'Nunca estuvo en un conteo cerrado.'
};

export interface TrafficInput {
	lastCountedAt: string | null;
	createdAt: string | null;
}

/** Días previos sin conteo en los que un ítem cuenta como «nuevo» (verde, aún no le toca). */
function isBrandNewUninput(input: TrafficInput, cycleDays: number, nowMs: number): boolean {
	if (input.createdAt == null) return false;
	const createdAge = daysSince(input.createdAt, nowMs);
	return createdAge != null && createdAge <= cycleDays * CYCLE_SOON_RATIO;
}

export function trafficStateFor(
	input: TrafficInput,
	cycleDays: number,
	nowMs: number = Date.now()
): TrafficState {
	if (input.lastCountedAt != null) {
		const age = daysSince(input.lastCountedAt, nowMs) ?? 0;
		if (age <= cycleDays * CYCLE_SOON_RATIO) return 'ok';
		if (age <= cycleDays) return 'soon';
		return 'over';
	}
	// Ítem nuevo: nace verde hasta que supere el 75 % del plazo sin haberse contado.
	if (isBrandNewUninput(input, cycleDays, nowMs)) return 'ok';
	return 'none';
}

/** Ítem sin conteo que aún disfruta la regla «nace verde». */
export function isNewUnverified(
	input: TrafficInput,
	cycleDays: number,
	nowMs: number = Date.now()
): boolean {
	return input.lastCountedAt == null && isBrandNewUninput(input, cycleDays, nowMs);
}

export function trafficStateByMedianAge(
	medianAgeDays: number | null,
	cycleDays: number
): TrafficState {
	if (medianAgeDays == null) return 'none';
	if (medianAgeDays <= cycleDays * CYCLE_SOON_RATIO) return 'ok';
	if (medianAgeDays <= cycleDays) return 'soon';
	return 'over';
}

// ── Líneas: conteo, recuento y diferencia ───────────────────────────────────

export interface CountLineCore {
	id: number;
	itemType: string;
	systemStock: number;
	countedStock: number | null;
	recountedStock: number | null;
	/** Movimiento de inventario creado por el ajuste vinculado (null = sin ajuste). */
	adjustmentMovementId: string | null;
}

/** Valor válido del conteo: recuento (Revisar) si existe, si no el conteo de fase ①. */
export function finalCount(line: CountLineCore): number | null {
	return line.recountedStock ?? line.countedStock;
}

export function lineDiff(line: CountLineCore): number | null {
	const value = finalCount(line);
	return value == null ? null : value - line.systemStock;
}

/** true si la línea quedó verificada: contada, confirmada en 0 o recontada. */
export function isLineVerified(line: CountLineCore): boolean {
	return finalCount(line) != null;
}

export type DiffGravity = 'pending' | 'match' | 'low' | 'high';

export function diffGravity(
	line: CountLineCore,
	config: Pick<CountCycleConfig, 'diffThresholdUnits' | 'diffThresholdUsd'>,
	/** Costo unitario FIFO del ítem (para el umbral en USD). */
	unitCost: number | null = null
): DiffGravity {
	const diff = lineDiff(line);
	if (diff == null) return 'pending';
	if (diff === 0) return 'match';
	const unitsExceeded = Math.abs(diff) >= config.diffThresholdUnits;
	const usdExceeded =
		config.diffThresholdUsd > 0 &&
		unitCost != null &&
		Math.abs(diff * unitCost) >= config.diffThresholdUsd;
	return unitsExceeded || usdExceeded ? 'high' : 'low';
}

/** ¿La línea exige recuento antes de poder cerrar? (solo dif. sobre el umbral sin recuento). */
export function requiresRecount(
	line: CountLineCore,
	config: Pick<CountCycleConfig, 'diffThresholdUnits' | 'diffThresholdUsd'>,
	unitCost: number | null = null
): boolean {
	if (line.recountedStock != null) return false;
	return diffGravity(line, config, unitCost) === 'high';
}

// ── Resumen de sesión y regla de cierre ────────────────────────────────────

export interface CountSessionStats {
	total: number;
	/** Verificados: contados, confirmados en 0 o recontados. */
	verified: number;
	/** Pendientes con stock > 0 (bloquean el cierre). */
	pendingCounting: number;
	/** Pendientes con stock 0 (no bloquean; tampoco verifican). */
	zeroStockPending: number;
	matchCount: number;
	diffCount: number;
	surplusLines: number;
	surplusUnits: number;
	missingLines: number;
	missingUnits: number;
	/** Variación neta en unidades. */
	varianceUnits: number;
	/** Diferencias con ajuste ya aplicado (movimiento vinculado). */
	adjustmentsApplied: number;
	/** Diferencias bajo umbral que aún pueden ajustarse en lote. */
	adjustmentsPending: number;
	/** Recuentos obligatorios pendientes (bloquean el cierre). */
	recountsPending: number;
	/** Costo estimado del impacto (dif × costo FIFO). */
	impactCost: number;
	progressPercent: number;
	varianceLabel: string;
}

export function computeCountStats(
	lines: CountLineCore[],
	config: Pick<CountCycleConfig, 'diffThresholdUnits' | 'diffThresholdUsd'>,
	costByLineId: Map<number, number | null> = new Map()
): CountSessionStats {
	const stats: CountSessionStats = {
		total: lines.length,
		verified: 0,
		pendingCounting: 0,
		zeroStockPending: 0,
		matchCount: 0,
		diffCount: 0,
		surplusLines: 0,
		surplusUnits: 0,
		missingLines: 0,
		missingUnits: 0,
		varianceUnits: 0,
		adjustmentsApplied: 0,
		adjustmentsPending: 0,
		recountsPending: 0,
		impactCost: 0,
		progressPercent: 0,
		varianceLabel: 'Sin variación neta'
	};

	for (const line of lines) {
		const final = finalCount(line);
		if (final != null) {
			stats.verified += 1;
			const diff = final - line.systemStock;
			if (diff === 0) {
				stats.matchCount += 1;
			} else {
				stats.diffCount += 1;
				if (diff > 0) {
					stats.surplusLines += 1;
					stats.surplusUnits += diff;
				} else {
					stats.missingLines += 1;
					stats.missingUnits += Math.abs(diff);
				}
				stats.impactCost += diff * (costByLineId.get(line.id) ?? 0);
				if (line.adjustmentMovementId != null) {
					stats.adjustmentsApplied += 1;
				} else if (Math.abs(diff) < config.diffThresholdUnits) {
					stats.adjustmentsPending += 1;
				}
			}
		} else if (line.systemStock > 0) {
			stats.pendingCounting += 1;
		} else {
			stats.zeroStockPending += 1;
		}
		if (
			final != null &&
			diffGravity(line, config, costByLineId.get(line.id) ?? null) === 'high' &&
			line.recountedStock == null
		) {
			stats.recountsPending += 1;
		}
	}

	stats.varianceUnits = stats.surplusUnits - stats.missingUnits;
	stats.varianceLabel =
		stats.varianceUnits === 0
			? 'Sin variación neta'
			: stats.varianceUnits > 0
				? `+${stats.varianceUnits}`
				: `${stats.varianceUnits}`;
	stats.progressPercent = stats.total === 0 ? 0 : Math.round((stats.verified / stats.total) * 100);
	return stats;
}

/**
 * Regla de cierre (rediseño):
 * 1. Todas las líneas con `systemStock > 0` deben estar contadas (o recontadas).
 * 2. Toda diferencia sobre el umbral debe haber sido recontada.
 * Las líneas con stock 0 sin confirmar NO bloquean — pero tampoco verifican.
 */
export function canCloseSession(stats: {
	pendingCounting: number;
	recountsPending: number;
	total: number;
}): boolean {
	return stats.total > 0 && stats.pendingCounting === 0 && stats.recountsPending === 0;
}

/** Regla legacy mantenida para compatibilidad: 100 % de las líneas contadas. */
export function canCloseInventoryCountSession(totalLines: number, countedLines: number): boolean {
	return totalLines > 0 && countedLines === totalLines;
}

// ── Filtros de UI ───────────────────────────────────────────────────────────

export const UI_FILTER_LABELS: Record<InventoryCountUiFilter, string> = {
	ALL: 'Todos',
	PENDING: 'Pendientes',
	WITH_DIFF: 'Con dif.',
	ZERO_STOCK: 'Stock 0'
};

export function lineMatchesFilter(line: CountLineCore, filter: InventoryCountUiFilter): boolean {
	const diff = lineDiff(line);
	switch (filter) {
		case 'ALL':
			return true;
		case 'PENDING':
			return finalCount(line) == null;
		case 'WITH_DIFF':
			return diff != null && diff !== 0;
		case 'ZERO_STOCK':
			return line.systemStock === 0;
	}
}

export function lineMatchesSearch(
	line: { itemName: string; itemCode: string | null },
	search: string
): boolean {
	const query = search.trim().toLowerCase();
	if (!query) return true;
	return [line.itemName, line.itemCode ?? ''].join(' ').toLowerCase().includes(query);
}

// ── Estado del ciclo (resumen de cobertura) ────────────────────────────────

export interface CoverageSummary {
	itemCount: number;
	/** Ítems verificados dentro del plazo (incluye «nuevos» aún no contados). */
	okCount: number;
	soonCount: number;
	overCount: number;
	neverCounted: number;
	/** Ítems «verde por nuevo» (sin conteo, creados dentro del margen). */
	newCount: number;
	verifiedPercent: number;
	/** Fecha del último conteo CERRADO donde la cobertura llegó a 100 % (o null). */
	lastFullCycleAt: string | null;
}

export function emptyCoverageSummary(): CoverageSummary {
	return {
		itemCount: 0,
		okCount: 0,
		soonCount: 0,
		overCount: 0,
		neverCounted: 0,
		newCount: 0,
		verifiedPercent: 0,
		lastFullCycleAt: null
	};
}

export function summarizeCoverage(
	items: Array<TrafficInput>,
	cycleDays: number,
	nowMs: number = Date.now()
): CoverageSummary {
	const summary = emptyCoverageSummary();
	summary.itemCount = items.length;
	for (const item of items) {
		if (isNewUnverified(item, cycleDays, nowMs)) {
			summary.newCount += 1;
			summary.okCount += 1;
			continue;
		}
		switch (trafficStateFor(item, cycleDays, nowMs)) {
			case 'ok':
				summary.okCount += 1;
				break;
			case 'soon':
				summary.soonCount += 1;
				break;
			case 'over':
				summary.overCount += 1;
				break;
			case 'none':
				summary.neverCounted += 1;
				break;
		}
	}
	summary.verifiedPercent =
		summary.itemCount === 0 ? 0 : Math.round((summary.okCount / summary.itemCount) * 100);
	return summary;
}

// ── Alcance y estado de sesión ─────────────────────────────────────────────

export const SESSION_STATUS_LABELS: Record<InventoryCountSessionStatus, string> = {
	OPEN: 'Abierta',
	APPLIED: 'Aplicada',
	CANCELLED: 'Cancelada'
};

export function statusLabelFor(status: string): string {
	return SESSION_STATUS_LABELS[status as InventoryCountSessionStatus] ?? status;
}

export type CountStatusVariant = 'success' | 'warning' | 'neutral';
export function statusVariantFor(status: string): CountStatusVariant {
	if (status === 'OPEN') return 'warning';
	if (status === 'APPLIED') return 'success';
	return 'neutral';
}

export const SCOPE_DIM_LABELS: Record<InventoryCountScopeDim, string> = {
	ALL: 'Todo el inventario',
	BRAND: 'Marca',
	SUPPLIER: 'Proveedor',
	TYPE: 'Tipo'
};

export function formatCountScopeLabel(scope: {
	kind: InventoryCountScopeKind;
	dim: InventoryCountScopeDim;
	valueLabels: string[];
	n: number | null;
}): string {
	if (scope.kind === 'QUICK_OLDEST') return `Los ${scope.n ?? 0} más atrasados`;
	if (scope.kind === 'QUICK_NEVER') return 'Solo nunca contados';
	if (scope.kind === 'ALL' || scope.dim === 'ALL') return 'Todo el inventario';
	const own = SCOPE_DIM_LABELS[scope.dim];
	if (scope.valueLabels.length === 0) return own;
	if (scope.valueLabels.length === 1) return `${own}: ${scope.valueLabels[0]}`;
	return `${own}: ${scope.valueLabels[0]} + ${scope.valueLabels.length - 1}`;
}

export function initialsFor(name: string): string {
	// Sin regex (S5853): corta en el primer '(' con indexOf.
	const parenIndex = name.indexOf('(');
	const cleaned = (parenIndex >= 0 ? name.slice(0, parenIndex) : name).trim();
	return cleaned
		.split(/\s+/)
		.map((part) => part[0] ?? '')
		.join('')
		.slice(0, 2)
		.toUpperCase();
}
