/**
 * Lógica de fase del espacio de trabajo de conteo (① Contar · ② Revisar · ③ Informe).
 *
 * Funciones puras para que la página solo orqueste efectos (navegación, remotes,
 * toasts). Spec 7.5 del prompt y el mockup (stepper: `if(p==3)break` — el cierre
 * nunca se dispara desde un paso del stepper).
 */
import { splitTooltip } from '$lib/utils/tooltip';
import { lineDiff, type CountLineCore } from './inventoryCount';

export interface PhaseStats {
	pendingCounting: number;
	recountsPending: number;
}

/** Label del CTA de fase. */
export function phaseCtaLabel(phase: 1 | 2 | 3): string {
	if (phase === 3) return 'Volver a cobertura';
	return phase === 1 ? 'Revisar →' : 'Cerrar conteo';
}

/** Motivo `Título|Cuerpo` por el que el CTA está bloqueado; null si está libre. */
export function phaseCtaReason(phase: 1 | 2 | 3, stats: PhaseStats): string | null {
	if (phase === 1) {
		return stats.pendingCounting > 0
			? `Faltan ${stats.pendingCounting} por contar|Cuando no queden pendientes pasas a revisar diferencias.`
			: null;
	}
	if (phase === 2) {
		return stats.recountsPending > 0
			? `Faltan ${stats.recountsPending} recuentos|Las diferencias sobre el umbral deben recontarse.`
			: null;
	}
	return null;
}

export type PhaseCtaAction = 'back' | 'review' | 'close' | 'blocked';

/**
 * Qué hace el CTA en la fase actual. `'blocked'` ⇒ la página muestra el motivo
 * (nunca un clic en silencio).
 */
export function phaseCtaAction(
	phase: 1 | 2 | 3,
	stats: PhaseStats,
	canCloseNow: boolean
): PhaseCtaAction {
	if (phase === 3) return 'back';
	if (phaseCtaReason(phase, stats)) return 'blocked';
	if (phase === 1) return 'review';
	return canCloseNow ? 'close' : 'blocked';
}

export type StepOutcome = { kind: 'noop' } | { kind: 'phase'; phase: 1 | 2 } | { kind: 'blocked' };

/**
 * Clic en un paso del stepper: retroceso libre entre ①↔② (estado local),
 * avance solo si el CTA lo permite, y nunca salta a 3 — el cierre es solo
 * con el CTA dorado (mockup: `if(p==3)break`).
 */
export function stepClickOutcome(
	step: 1 | 2 | 3,
	phase: 1 | 2 | 3,
	reason: string | null
): StepOutcome {
	if (step === phase || step === 3) return { kind: 'noop' };
	if (step < phase) return { kind: 'phase', phase: step };
	return reason ? { kind: 'blocked' } : { kind: 'phase', phase: step };
}

/** Filas con diferencia (≠0) ordenadas por impacto |diff × costo| descendente. */
export function buildDiffRows<Line extends CountLineCore>(
	lines: Line[],
	costByLineId: Map<number, number | null>
): Array<{ line: Line; diff: number }> {
	return lines
		.map((line) => ({ line, diff: lineDiff(line) }))
		.filter(
			(entry): entry is { line: Line; diff: number } => entry.diff != null && entry.diff !== 0
		)
		.sort((a, b) => {
			const costA = costByLineId.get(a.line.id) ?? 0;
			const costB = costByLineId.get(b.line.id) ?? 0;
			return Math.abs(b.diff * costB) - Math.abs(a.diff * costA);
		});
}

/** Payload del toast de bloqueo: título + descripción del motivo `Título|Cuerpo`. */
export function blockedToast(reason: string | null): { title: string; description?: string } {
	const tip = splitTooltip(reason ?? undefined);
	return { title: tip.title ?? 'No disponible todavía', description: tip.text };
}
