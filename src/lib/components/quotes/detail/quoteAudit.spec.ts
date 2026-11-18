import { describe, expect, it } from 'vitest';
import {
	classifyQuoteAuditEntry,
	matchesQuoteAuditFilter,
	quoteEditSummary,
	type QuoteAuditEntry
} from './quoteAudit';

const CTX = {
	sourceQuoteNumber: 231,
	convertedOrderNumber: 298,
	quoteIsCashea: true,
	createdWithoutCustomer: false
};

function entry(partial: Partial<QuoteAuditEntry>): QuoteAuditEntry {
	return {
		id: 'e-1',
		action: 'update',
		changes: null,
		changedAt: '2026-11-17T14:24:00Z',
		changedByName: 'Ana Pérez',
		...partial
	};
}

describe('classifyQuoteAuditEntry', () => {
	it('creado con origen → "Duplicado de P-0231"', () => {
		const e = classifyQuoteAuditEntry(entry({ action: 'create' }), CTX);
		expect(e?.title).toBe('Presupuesto creado');
		expect(e?.detail).toBe('Duplicado de P-0231');
		expect(e?.tone).toBe('navy');
	});

	it('creado sin cliente → "Sin cliente"', () => {
		const e = classifyQuoteAuditEntry(entry({ action: 'create' }), {
			...CTX,
			sourceQuoteNumber: null,
			createdWithoutCustomer: true
		});
		expect(e?.detail).toBe('Sin cliente');
	});

	it('convertido → "Convertido en venta #0298" + "Cashea activado"', () => {
		const e = classifyQuoteAuditEntry(
			entry({ changes: { status: { old: 'DRAFT', new: 'CONVERTED' } } }),
			CTX
		);
		expect(e?.title).toBe('Convertido en venta #0298');
		expect(e?.detail).toBe('Cashea activado');
		expect(e?.tone).toBe('success');
	});

	it('convertido sin Cashea → sin detalle', () => {
		const e = classifyQuoteAuditEntry(
			entry({ changes: { status: { old: 'DRAFT', new: 'CONVERTED' } } }),
			{ ...CTX, quoteIsCashea: false }
		);
		expect(e?.detail).toBeNull();
	});

	it('cancelado → motivo', () => {
		const e = classifyQuoteAuditEntry(
			entry({
				changes: { status: { old: 'DRAFT', new: 'CANCELLED' } },
				reason: 'El cliente desistió'
			}),
			CTX
		);
		expect(e?.title).toBe('Presupuesto cancelado');
		expect(e?.detail).toBe('El cliente desistió');
	});

	it('editado → resumen del diff', () => {
		const e = classifyQuoteAuditEntry(
			entry({ changes: { isCashea: { old: false, new: true }, notes: { old: null, new: 'x' } } }),
			CTX
		);
		expect(e?.title).toBe('Presupuesto editado');
		expect(e?.detail).toBe('Cashea activado · Nota');
	});
});

describe('quoteEditSummary', () => {
	it('null sin cambios', () => {
		expect(quoteEditSummary(null)).toBeNull();
		expect(quoteEditSummary({})).toBeNull();
	});

	it('Cashea quitado', () => {
		expect(quoteEditSummary({ isCashea: { old: true, new: false } })).toBe('Cashea quitado');
	});
});

describe('matchesQuoteAuditFilter', () => {
	const e = classifyQuoteAuditEntry(entry({ changes: { notes: { new: 'x' } } }), CTX);
	expect(e).toBeTruthy();
	it('ediciones filtra solo pen', () => {
		if (!e) throw new Error('no event');
		expect(matchesQuoteAuditFilter(e, 'edits')).toBe(true);
		expect(matchesQuoteAuditFilter(e, 'states')).toBe(false);
	});
});
