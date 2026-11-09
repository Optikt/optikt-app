import { describe, expect, it } from 'vitest';
import {
	blockedToast,
	phaseCtaAction,
	phaseCtaLabel,
	phaseCtaReason,
	stepClickOutcome,
	type PhaseStats
} from './countSessionPhase';

const clean: PhaseStats = { pendingCounting: 0, recountsPending: 0 };
const pending: PhaseStats = { pendingCounting: 3, recountsPending: 0 };
const recounts: PhaseStats = { pendingCounting: 0, recountsPending: 2 };

describe('phaseCtaLabel', () => {
	it('etiqueta cada fase según spec 7.5', () => {
		expect(phaseCtaLabel(1)).toBe('Revisar →');
		expect(phaseCtaLabel(2)).toBe('Cerrar conteo');
		expect(phaseCtaLabel(3)).toBe('Volver a cobertura');
	});
});

describe('phaseCtaReason', () => {
	it('fase 1 sin pendientes y fase 3 no tienen motivo', () => {
		expect(phaseCtaReason(1, clean)).toBeNull();
		expect(phaseCtaReason(3, clean)).toBeNull();
	});

	it('fase 1 explica los pendientes con formato Título|Cuerpo', () => {
		expect(phaseCtaReason(1, pending)).toBe(
			'Faltan 3 por contar|Cuando no queden pendientes pasas a revisar diferencias.'
		);
	});

	it('fase 2 explica los recuentos pendientes', () => {
		expect(phaseCtaReason(2, recounts)).toBe(
			'Faltan 2 recuentos|Las diferencias sobre el umbral deben recontarse.'
		);
		expect(phaseCtaReason(2, clean)).toBeNull();
	});
});

describe('phaseCtaAction', () => {
	it('fase 3 siempre vuelve a cobertura', () => {
		expect(phaseCtaAction(3, clean, false)).toBe('back');
		expect(phaseCtaAction(3, recounts, true)).toBe('back');
	});

	it('fase 1 avanza solo sin pendientes', () => {
		expect(phaseCtaAction(1, clean, false)).toBe('review');
		expect(phaseCtaAction(1, pending, false)).toBe('blocked');
	});

	it('fase 2 cierra solo con canCloseNow', () => {
		expect(phaseCtaAction(2, clean, true)).toBe('close');
		expect(phaseCtaAction(2, recounts, false)).toBe('blocked');
		// Pendientes de conteo en fase 2 (tras un retroceso) también bloquean.
		expect(phaseCtaAction(2, pending, false)).toBe('blocked');
	});
});

describe('stepClickOutcome', () => {
	it('nunca salta a 3 desde el stepper (el cierre es con el CTA)', () => {
		expect(stepClickOutcome(3, 1, null)).toEqual({ kind: 'noop' });
		expect(stepClickOutcome(3, 2, null)).toEqual({ kind: 'noop' });
	});

	it('clic en el paso actual es no-op', () => {
		expect(stepClickOutcome(1, 1, null)).toEqual({ kind: 'noop' });
		expect(stepClickOutcome(2, 2, null)).toEqual({ kind: 'noop' });
	});

	it('retroceso de Revisar a Contar es libre', () => {
		expect(stepClickOutcome(1, 2, 'Faltan 2 recuentos|x')).toEqual({
			kind: 'phase',
			phase: 1
		});
	});

	it('avanza de Contar a Revisar cuando el CTA está libre', () => {
		expect(stepClickOutcome(2, 1, null)).toEqual({ kind: 'phase', phase: 2 });
	});

	it('avance bloqueado devuelve blocked (con el motivo)', () => {
		expect(stepClickOutcome(2, 1, 'Faltan 3 por contar|x')).toEqual({ kind: 'blocked' });
	});
});

describe('blockedToast', () => {
	it('parte el motivo Título|Cuerpo en title/description', () => {
		expect(blockedToast('Faltan 3 por contar|Cuando no queden…')).toEqual({
			title: 'Faltan 3 por contar',
			description: 'Cuando no queden…'
		});
	});

	it('sin motivo devuelve un título por defecto', () => {
		expect(blockedToast(null)).toEqual({ title: 'No disponible todavía' });
	});
});
