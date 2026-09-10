import { getInventoryCountStatusLabel } from '$lib/schemas/inventoryCount';
import type { BadgeVariant } from '$lib/shared/badge-variants';
import type { InventoryCountUiFilter } from '$lib/schemas/inventoryCount';
import type {
	InventoryCountLineRow,
	InventoryCountSessionDetail
} from '$lib/server/db/queries/inventoryCount';
import { formatDate } from '$lib/utils';

export type SummaryMetricTone = 'neutral' | 'success' | 'warning' | 'error';

export interface SummaryMetric {
	id: string;
	label: string;
	value: string;
	tone: SummaryMetricTone;
}

export interface CountStats {
	total: number;
	counted: number;
	pending: number;
	positiveDiffCount: number;
	negativeDiffCount: number;
	diffCount: number;
	matchedCount: number;
	completedAdjustments: number;
	pendingAdjustments: number;
	positiveUnits: number;
	negativeUnits: number;
	varianceUnits: number;
	varianceLabel: string;
	progressPercent: number;
}

export function computeCountStats(lines: InventoryCountLineRow[]): CountStats {
	const total = lines.length;
	const countedLines = lines.filter((line) => line.countedStock !== null);
	const counted = countedLines.length;
	const pending = total - counted;
	const positiveDiffCount = countedLines.filter((line) => (line.difference ?? 0) > 0).length;
	const negativeDiffCount = countedLines.filter((line) => (line.difference ?? 0) < 0).length;
	const diffCount = countedLines.filter((line) => (line.difference ?? 0) !== 0).length;
	const matchedCount = countedLines.filter((line) => (line.difference ?? 0) === 0).length;
	const completedAdjustments = countedLines.filter(
		(line) => (line.difference ?? 0) !== 0 && line.adjustmentCompleted
	).length;
	const pendingAdjustments = diffCount - completedAdjustments;
	const positiveUnits = countedLines
		.filter((line) => (line.difference ?? 0) > 0)
		.reduce((sum, line) => sum + Math.max(line.difference ?? 0, 0), 0);
	const negativeUnits = countedLines
		.filter((line) => (line.difference ?? 0) < 0)
		.reduce((sum, line) => sum + Math.abs(Math.min(line.difference ?? 0, 0)), 0);
	const varianceUnits = positiveUnits - negativeUnits;

	return {
		total,
		counted,
		pending,
		positiveDiffCount,
		negativeDiffCount,
		diffCount,
		matchedCount,
		completedAdjustments,
		pendingAdjustments,
		positiveUnits,
		negativeUnits,
		varianceUnits,
		varianceLabel:
			varianceUnits === 0
				? 'Sin variación neta'
				: varianceUnits > 0
					? `+${varianceUnits}`
					: `${varianceUnits}`,
		progressPercent: total === 0 ? 0 : Math.round((counted / total) * 100)
	};
}

export function filterCountLines(
	lines: InventoryCountLineRow[],
	filter: InventoryCountUiFilter,
	search: string
): InventoryCountLineRow[] {
	const normalizedSearch = search.trim().toLowerCase();

	return lines.filter((line) => {
		const matchesFilter =
			filter === 'ALL'
				? true
				: filter === 'PENDING'
					? line.countedStock === null
					: filter === 'WITH_DIFF'
						? line.countedStock !== null && (line.difference ?? 0) !== 0
						: line.countedStock !== null && (line.difference ?? 0) === 0;

		if (!matchesFilter) {
			return false;
		}

		if (!normalizedSearch) {
			return true;
		}

		const haystack = [line.itemName, line.itemCode, line.itemDetail]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return haystack.includes(normalizedSearch);
	});
}

export function buildSummaryMetrics(stats: CountStats): SummaryMetric[] {
	return [
		{
			id: 'coverage',
			label: 'Cobertura',
			value: `${stats.counted}/${stats.total}`,
			tone: stats.pending > 0 ? 'warning' : 'neutral'
		},
		{
			id: 'differences',
			label: 'Diferencias',
			value: String(stats.diffCount),
			tone: stats.diffCount > 0 ? 'warning' : 'neutral'
		},
		{
			id: 'variance',
			label: 'Variación',
			value: stats.varianceLabel,
			tone:
				stats.varianceUnits > 0 ? 'success' : stats.varianceUnits < 0 ? 'error' : 'neutral'
		},
		{
			id: 'adjustments',
			label: 'Ajustes',
			value: stats.diffCount === 0 ? '—' : `${stats.completedAdjustments}/${stats.diffCount}`,
			tone:
				stats.diffCount === 0
					? 'neutral'
					: stats.pendingAdjustments > 0
						? 'warning'
						: 'success'
		}
	];
}

export interface SummaryMessageInput {
	status: string;
	notes: string | null;
	cancelReason: string | null;
	canClose: boolean;
	pendingTotal: number;
	diffCount: number;
	pendingAdjustments: number;
}

export function buildSummaryMessage(input: SummaryMessageInput): {
	label: string;
	message: string;
} {
	const hasNotes = Boolean(input.notes?.trim());

	const label =
		input.status === 'CANCELLED'
			? 'Motivo'
			: hasNotes
				? 'Notas'
				: input.status === 'OPEN'
					? 'Siguiente paso'
					: 'Seguimiento';

	if (input.status === 'CANCELLED') {
		return {
			label,
			message: input.cancelReason?.trim() || 'Sesión cancelada sin motivo registrado.'
		};
	}

	const note = input.notes?.trim();
	if (note) {
		return { label, message: note };
	}

	if (input.status === 'OPEN') {
		return {
			label,
			message: input.canClose
				? 'Conteo completo. La sesión está lista para cerrarse.'
				: `Faltan ${input.pendingTotal} ${input.pendingTotal === 1 ? 'línea' : 'líneas'} por contar para poder cerrar la sesión.`
		};
	}

	if (input.diffCount === 0) {
		return { label, message: 'La sesión quedó registrada sin diferencias pendientes.' };
	}

	return {
		label,
		message:
			input.pendingAdjustments > 0
				? `${input.pendingAdjustments} ${input.pendingAdjustments === 1 ? 'línea requiere' : 'líneas requieren'} ajuste manual.`
				: 'Todos los ajustes manuales asociados ya fueron marcados como realizados.'
	};
}

export function statusLabelFor(status: string): string {
	return getInventoryCountStatusLabel(status);
}

export function statusVariant(status: string): BadgeVariant {
	if (status === 'OPEN') return 'warning';
	if (status === 'APPLIED') return 'success';
	return 'neutral';
}

export function compactStatClass(tone: SummaryMetricTone): string {
	if (tone === 'success') return 'text-success';
	if (tone === 'warning') return 'text-brand-gold';
	if (tone === 'error') return 'text-error';
	return 'text-brand-navy';
}

export function scopeLabelFor(session: InventoryCountSessionDetail): string {
	return session.scopeType === 'PRODUCT_CATEGORY'
		? `Solo productos${session.scopeValue ? ` - ${session.scopeValue}` : ''}`
		: session.scopeType === 'LENS'
			? 'Solo lentes STOCK'
			: 'Todo el inventario';
}

export function openedSummaryFor(session: InventoryCountSessionDetail): string {
	return `Apertura: ${formatDate(session.openedAt, { dateStyle: 'medium', timeStyle: 'short' })} · Responsable: ${session.openedByName ?? 'Usuario'}`;
}

export function lifecycleSummaryFor(session: InventoryCountSessionDetail): string | null {
	if (session.status === 'APPLIED' && session.appliedAt) {
		return `Cerró: ${session.appliedByName ?? 'Usuario'} · ${formatDate(session.appliedAt, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})}`;
	}

	if (session.status === 'CANCELLED') {
		const reason = session.cancelReason?.trim();
		return `Canceló: ${session.cancelledByName ?? 'Usuario'}${reason ? ` · ${reason}` : ''}`;
	}

	return null;
}
