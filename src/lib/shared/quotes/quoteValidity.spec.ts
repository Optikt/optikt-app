import { describe, expect, it } from 'vitest';
import {
	businessTodayISO,
	quoteValidity,
	quoteValidityDetailText,
	quoteValidityListText,
	shortDateLabel,
	businessDateISO
} from './quoteValidity';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

// "Hoy" fijo del negocio: 2026-11-18 (Caracas). Los validUntil se expresan
// como timestamps ISO que caen en el día Caracas indicado.
const TODAY = '2026-11-18';

/** Timestamp UTC que cae en `date` del negocio (Caracas UTC-4). */
function vetISO(date: string): string {
	return new Date(`${date}T10:00:00-04:00`).toISOString();
}

describe('businessTodayISO', () => {
	it('devuelve la fecha Caracas, no la UTC', () => {
		// 2026-11-19T00:30Z = 18/11 20:30 VET
		expect(businessTodayISO(new Date('2026-11-19T00:30:00Z'))).toBe('2026-11-18');
	});
});

describe('quoteValidity', () => {
	it('sin vencimiento → none', () => {
		expect(quoteValidity(null, QuoteStatus.DRAFT, TODAY)).toEqual({ kind: 'none' });
	});

	it('lejos (>3 días) → ok con días restantes', () => {
		const v = quoteValidity(vetISO('2026-11-29'), QuoteStatus.DRAFT, TODAY);
		expect(v.kind).toBe('ok');
		expect(v.daysLeft).toBe(11);
		expect(v.validUntilDate).toBe('2026-11-29');
	});

	it('mañana → soon (1 día)', () => {
		const v = quoteValidity(vetISO('2026-11-19'), QuoteStatus.DRAFT, TODAY);
		expect(v.kind).toBe('soon');
		expect(v.daysLeft).toBe(1);
	});

	it('hoy → soon (0 días)', () => {
		const v = quoteValidity(vetISO('2026-11-18'), QuoteStatus.DRAFT, TODAY);
		expect(v.kind).toBe('soon');
		expect(v.daysLeft).toBe(0);
	});

	it('ayer → expired', () => {
		const v = quoteValidity(vetISO('2026-11-17'), QuoteStatus.DRAFT, TODAY);
		expect(v.kind).toBe('expired');
		expect(v.daysLeft).toBe(-1);
	});

	it('borde soon = 3 días', () => {
		expect(quoteValidity(vetISO('2026-11-21'), QuoteStatus.DRAFT, TODAY).kind).toBe('soon');
		expect(quoteValidity(vetISO('2026-11-22'), QuoteStatus.DRAFT, TODAY).kind).toBe('ok');
	});

	it('convertido y cancelado → na (no importa la fecha)', () => {
		expect(quoteValidity(vetISO('2026-11-10'), QuoteStatus.CONVERTED, TODAY)).toEqual({
			kind: 'na'
		});
		expect(quoteValidity(null, QuoteStatus.CANCELLED, TODAY)).toEqual({ kind: 'na' });
	});
});

describe('textos', () => {
	it('lista: none / ok / soon / expired', () => {
		expect(quoteValidityListText({ kind: 'none' })).toBe('Sin vencimiento');
		expect(quoteValidityListText({ kind: 'ok', daysLeft: 11, validUntilDate: '2026-11-29' })).toBe(
			'29/11 · en 11 d'
		);
		expect(quoteValidityListText({ kind: 'soon', daysLeft: 1, validUntilDate: '2026-11-19' })).toBe(
			'Vence mañana'
		);
		expect(quoteValidityListText({ kind: 'soon', daysLeft: 0, validUntilDate: '2026-11-18' })).toBe(
			'Vence hoy'
		);
		expect(
			quoteValidityListText({ kind: 'expired', daysLeft: -9, validUntilDate: '2026-11-09' })
		).toBe('Vencido 09/11');
	});

	it('detalle: "vence en 11 días"', () => {
		expect(
			quoteValidityDetailText({ kind: 'ok', daysLeft: 11, validUntilDate: '2026-11-29' })
		).toBe('vence en 11 días');
		expect(quoteValidityDetailText({ kind: 'none' })).toBe('Sin vencimiento');
	});

	it('shortDateLabel', () => {
		expect(shortDateLabel('2026-11-09')).toBe('09/11');
	});
});

describe('businessDateISO', () => {
	it('usa el día de Caracas, no el UTC (01:30Z del 15 ≈ 21:30 del 14)', () => {
		expect(businessDateISO('2026-11-15T01:30:00.000Z')).toBe('2026-11-14');
		expect(businessDateISO('2026-11-14T20:10:00.000Z')).toBe('2026-11-14');
	});
});

describe('textos · todos los casos', () => {
	it('lista: soon hoy/mañana/N días, na → null', () => {
		expect(quoteValidityListText({ kind: 'soon', daysLeft: 0 })).toBe('Vence hoy');
		expect(quoteValidityListText({ kind: 'soon', daysLeft: 1 })).toBe('Vence mañana');
		expect(quoteValidityListText({ kind: 'soon', daysLeft: 3 })).toBe('Vence en 3 d');
		expect(quoteValidityListText({ kind: 'na' })).toBeNull();
	});

	it('detalle: none/soon/ok/expired/na', () => {
		expect(quoteValidityDetailText({ kind: 'none' })).toBe('Sin vencimiento');
		expect(quoteValidityDetailText({ kind: 'soon', daysLeft: 0 })).toBe('vence hoy');
		expect(quoteValidityDetailText({ kind: 'soon', daysLeft: 1 })).toBe('vence mañana');
		expect(quoteValidityDetailText({ kind: 'soon', daysLeft: 2 })).toBe('vence en 2 días');
		expect(quoteValidityDetailText({ kind: 'ok', daysLeft: 11 })).toBe('vence en 11 días');
		expect(
			quoteValidityDetailText({ kind: 'expired', daysLeft: -1, validUntilDate: '2026-11-14' })
		).toBe('vencido el 14/11');
		expect(quoteValidityDetailText({ kind: 'na' })).toBeNull();
	});
});
