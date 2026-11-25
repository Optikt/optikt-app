import { describe, expect, it } from 'vitest';
import { classifyQuoteAuditEntry, quoteEditSummary, type QuoteAuditEntry } from './quoteAudit';
import { matchesAuditFilter } from '$lib/utils/saleDetail';

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
	} as QuoteAuditEntry;
}

const diff = {
	v: 1,
	items: [
		{ t: 'add', name: 'Montura X', qty: 1, unitPrice: 20, total: 20 },
		{
			t: 'mod',
			name: 'Cristales',
			fields: [{ key: 'unitPrice', label: 'Precio', from: 'USD 50,00', to: 'USD 60,00' }]
		}
	],
	header: [{ key: 'isCashea', label: 'Cashea', from: 'No', to: 'Sí' }],
	totals: [{ label: 'Total', from: 100, to: 130 }]
};

describe('classifyQuoteAuditEntry', () => {
	it('creado con origen → nota "Duplicado de P-0231"', () => {
		const e = classifyQuoteAuditEntry(entry({ action: 'create' }), CTX);
		expect(e?.label).toBe('Presupuesto creado');
		expect(e?.note).toBe('Duplicado de P-0231');
		expect(e?.kind).toBe('create');
		expect(e?.entityType).toBe('quote');
	});

	it('creado sin cliente → "Sin cliente"', () => {
		const e = classifyQuoteAuditEntry(entry({ action: 'create' }), {
			...CTX,
			sourceQuoteNumber: null,
			createdWithoutCustomer: true
		});
		expect(e?.note).toBe('Sin cliente');
	});

	it('convertido → "Convertido en venta #0298" + "Cashea activado"', () => {
		const e = classifyQuoteAuditEntry(
			entry({ changes: { status: { old: 'DRAFT', new: 'CONVERTED' } } as never }),
			CTX
		);
		expect(e?.label).toBe('Convertido en venta #0298');
		expect(e?.note).toBe('Cashea activado');
		expect(e?.kind).toBe('status');
	});

	it('convertido sin Cashea ni número → sin nota', () => {
		const e = classifyQuoteAuditEntry(
			entry({ changes: { status: { old: 'DRAFT', new: 'CONVERTED' } } as never }),
			{ ...CTX, quoteIsCashea: false, convertedOrderNumber: null }
		);
		expect(e?.label).toBe('Convertido en venta');
		expect(e?.note).toBeNull();
	});

	it('cancelado → motivo (reason o cancellationReason)', () => {
		const withReason = classifyQuoteAuditEntry(
			entry({
				changes: { status: { old: 'DRAFT', new: 'CANCELLED' } } as never,
				reason: 'El cliente desistió'
			}),
			CTX
		);
		expect(withReason?.label).toBe('Presupuesto cancelado');
		expect(withReason?.kind).toBe('cancel');
		expect(withReason?.reason).toBe('El cliente desistió');

		const fromField = classifyQuoteAuditEntry(
			entry({
				changes: {
					status: { old: 'DRAFT', new: 'CANCELLED' },
					cancellationReason: { old: null, new: 'Precio alto' }
				} as never
			}),
			CTX
		);
		expect(fromField?.reason).toBe('Precio alto');
	});

	it('editado con itemsDiff → detalle estructurado como ventas', () => {
		const e = classifyQuoteAuditEntry(
			entry({
				changes: {
					total: { old: 100, new: 130 },
					itemsDiff: { old: null, new: diff }
				} as never
			}),
			CTX
		);
		expect(e?.label).toBe('Presupuesto editado');
		expect(e?.kind).toBe('update');
		expect(e?.itemsDiff?.items).toHaveLength(2);
		expect(e?.changeCount).toBe(4);
		expect(e?.totalDelta).toBe(30);
		expect(e?.legacyUpdate).toBe(false);
		expect(e?.note).toBeNull();
	});

	it('editado viejo (sin itemsDiff) → resumen corto y filas campo a campo', () => {
		const e = classifyQuoteAuditEntry(
			entry({
				changes: { isCashea: { old: false, new: true }, notes: { old: null, new: 'x' } } as never
			}),
			CTX
		);
		expect(e?.itemsDiff).toBeNull();
		expect(e?.note).toBe('Cashea activado · Nota');
		expect(e?.changes).not.toBeNull();
	});

	it('cambio de cliente → "Cliente actualizado"', () => {
		const e = classifyQuoteAuditEntry(
			entry({ changes: { customerId: { old: null, new: 'c-1' } } as never }),
			CTX
		);
		expect(e?.label).toBe('Cliente actualizado');
	});

	it('cambio solo de grupos → "Agrupación por persona actualizada" con resumen', () => {
		const e = classifyQuoteAuditEntry(
			entry({
				changes: {
					personGroups: { old: 'Sin agrupación', new: 'Ana: Montura ×1' }
				} as never
			}),
			CTX
		);
		expect(e?.label).toBe('Agrupación por persona actualizada');
		expect(e?.note).toBe('Ana: Montura ×1');
	});

	it('acciones desconocidas → null', () => {
		expect(classifyQuoteAuditEntry(entry({ action: 'delete' }), CTX)).toBeNull();
	});

	it('filtros del drawer: edición en Ediciones, cancelado en Estados', () => {
		const edit = classifyQuoteAuditEntry(entry({ changes: { notes: { new: 'x' } } as never }), CTX);
		const cancel = classifyQuoteAuditEntry(
			entry({ changes: { status: { new: 'CANCELLED' } } as never }),
			CTX
		);
		if (!edit || !cancel) throw new Error('no event');
		expect(matchesAuditFilter(edit, 'edits')).toBe(true);
		expect(matchesAuditFilter(edit, 'states')).toBe(false);
		expect(matchesAuditFilter(cancel, 'states')).toBe(true);
	});
});

describe('quoteEditSummary', () => {
	it('null sin cambios', () => {
		expect(quoteEditSummary(null)).toBeNull();
		expect(quoteEditSummary({})).toBeNull();
	});

	it('Cashea quitado, cliente, descuento, validez, ítems', () => {
		expect(quoteEditSummary({ isCashea: { old: true, new: false } })).toBe('Cashea quitado');
		expect(
			quoteEditSummary({
				customerId: { new: 'c' },
				discount: { new: 1 },
				validUntil: { new: 'x' },
				total: { new: 2 }
			})
		).toBe('Cliente · Descuento · Validez · Ítems');
	});
});
