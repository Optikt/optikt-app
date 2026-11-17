import { describe, expect, it } from 'vitest';
import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import { formatCurrency, formatPrice } from '$lib/utils';
import {
	auditDiffRows,
	classifySaleAuditEntry,
	hasAuditDetail,
	matchesAuditFilter,
	saleAuditTotalDelta,
	type AuditEvent
} from './saleDetail';

function entry(overrides: Record<string, unknown> = {}): ChangeHistoryWithUser {
	return {
		id: 'event-1',
		entityType: 'sale',
		entityId: 'sale-1',
		action: 'create',
		changes: {},
		changedAt: '2026-11-07T11:48:00.000Z',
		changedByName: 'Optikt Admin',
		...overrides
	} as unknown as ChangeHistoryWithUser;
}

function eventOf(overrides: Record<string, unknown>): AuditEvent {
	const classified = classifySaleAuditEntry(entry(overrides));
	if (!classified) throw new Error('expected a classified event');
	return classified;
}

describe('classifySaleAuditEntry', () => {
	it('classifies creation', () => {
		const event = classifySaleAuditEntry(entry({ action: 'create' }));
		expect(event).toMatchObject({
			label: 'Venta creada',
			kind: 'create',
			changes: null,
			reason: null
		});
	});

	it('classifies a status change with its label', () => {
		const event = eventOf({
			action: 'update',
			changes: { status: { old: 'PENDING', new: 'READY' } }
		});
		expect(event.label).toBe('Estado: Lista para Retirar');
		expect(event.kind).toBe('status');
	});

	it('classifies cancellation as cancel with the stored reason', () => {
		const event = eventOf({
			action: 'update',
			changes: {
				status: { old: 'PENDING', new: 'CANCELLED' },
				cancellationReason: { old: null, new: 'El cliente desistió' },
				refundAmount: { old: null, new: 70 }
			}
		});
		expect(event.kind).toBe('cancel');
		expect(event.label).toBe('Venta cancelada');
		expect(event.reason).toBe('El cliente desistió');
		// Raw payload kept for the diff (reason excluded later by auditDiffRows).
		expect(event.changes).not.toBeNull();
	});

	it('classifies customer and seller updates', () => {
		expect(
			eventOf({ action: 'update', changes: { customerId: { old: 'a', new: 'b' } } }).label
		).toBe('Cliente actualizado');
		expect(eventOf({ action: 'update', changes: { sellerId: { old: 'a', new: 'b' } } }).label).toBe(
			'Vendedor actualizado'
		);
	});

	it('falls back to a generic update and ignores non-sale entities or actions', () => {
		expect(eventOf({ action: 'update', changes: { notes: { old: '', new: 'x' } } }).label).toBe(
			'Venta actualizada'
		);
		expect(classifySaleAuditEntry(entry({ entityType: 'sale_item' }))).toBeNull();
		expect(classifySaleAuditEntry(entry({ action: 'delete' }))).toBeNull();
	});
});

describe('auditDiffRows', () => {
	it('excludes status and cancellation reason (already shown as title/reason)', () => {
		const event = eventOf({
			action: 'update',
			changes: {
				status: { old: 'PENDING', new: 'CANCELLED' },
				cancellationReason: { old: null, new: 'Motivo' },
				notes: { old: null, new: 'compra con cashea' }
			}
		});
		const rows = auditDiffRows(event);
		expect(rows.map((r) => r.field)).toEqual(['notes']);
		expect(rows[0]).toMatchObject({
			label: 'Notas',
			from: '-',
			to: 'compra con cashea'
		});
	});

	it('formats money values as USD and booleans as Sí/No', () => {
		const event = eventOf({
			action: 'update',
			changes: {
				total: { old: 130, new: 140 },
				isCashea: { old: false, new: true }
			}
		});
		const rows = auditDiffRows(event);
		const total = rows.find((r) => r.field === 'total');
		const cashea = rows.find((r) => r.field === 'isCashea');
		// Money fields are formatted with the repo's canonical money formatter.
		expect(total?.from).toBe(formatPrice(130));
		expect(total?.to).toBe(formatPrice(140));
		expect(cashea?.from).toBe('No');
		expect(cashea?.to).toBe('Sí');
	});

	it('hasAuditDetail is true with reason only, false for bare events', () => {
		const withReason = eventOf({
			action: 'update',
			changes: {
				status: { old: 'PENDING', new: 'CANCELLED' },
				cancellationReason: { old: null, new: 'Motivo' }
			}
		});
		expect(hasAuditDetail(withReason)).toBe(true);
		expect(hasAuditDetail(eventOf({ action: 'create' }))).toBe(false);
	});

	it('renders sale_payment rows with friendly Spanish labels and values', () => {
		const event = eventOf({
			entityType: 'sale_payment',
			action: 'create',
			changes: {
				id: { old: null, new: 'pay-1' },
				saleId: { old: null, new: 'sale-1' },
				paymentMethod: { old: null, new: 'PAGO_MOVIL_BS' },
				amount: { old: null, new: 62827.8 },
				rateType: { old: null, new: 'OTHER' },
				bcvRate: { old: null, new: 897.54 },
				amountBcvUsd: { old: null, new: 70 },
				isCasheaPayment: { old: null, new: false },
				reference: { old: null, new: '405291' },
				paymentDate: { old: null, new: '2026-11-13 20:02:56+00' },
				createdById: { old: null, new: 'user-1' }
			}
		});
		const rows = auditDiffRows(event);
		const byField = Object.fromEntries(rows.map((r) => [r.field, r]));
		// Raw ids never render.
		expect(rows.map((r) => r.field)).not.toContain('id');
		expect(rows.map((r) => r.field)).not.toContain('saleId');
		expect(rows.map((r) => r.field)).not.toContain('createdById');
		expect(byField.paymentMethod.label).toBe('Método de pago');
		expect(byField.amount.label).toBe('Monto');
		expect(byField.amount.to).toBe(`Bs. ${formatCurrency(62827.8)}`);
		expect(byField.rateType).toMatchObject({ label: 'Tipo de tasa', to: 'Otro' });
		expect(byField.bcvRate.label).toBe('Tasa BCV');
		expect(byField.amountBcvUsd.label).toBe('Equivalente en USD');
		expect(byField.isCasheaPayment).toMatchObject({ label: 'Pago Cashea', to: 'No' });
		expect(byField.reference).toMatchObject({ label: 'Referencia', to: '405291' });
		// Space-separated DB timestamps format as dates, never raw.
		expect(byField.paymentDate.label).toBe('Fecha de pago');
		expect(byField.paymentDate.to).not.toMatch(/20:02:56|\+00/);
	});
});

describe('classifySaleAuditEntry with itemsDiff', () => {
	const diff = {
		v: 1,
		items: [{ t: 'add', name: 'Montura X', qty: 1, unitPrice: 20, total: 20 }],
		header: [],
		totals: [{ label: 'Total', from: 100, to: 120 }]
	};

	it('attaches the parsed diff, delta and change count', () => {
		const event = eventOf({
			action: 'update',
			changes: {
				total: { old: 100, new: 120 },
				itemsDiff: { old: null, new: diff }
			}
		});
		expect(event.kind).toBe('update');
		expect(event.legacyUpdate).toBe(false);
		expect(event.itemsDiff).toEqual(diff);
		expect(event.totalDelta).toBe(20);
		expect(event.changeCount).toBe(2);
		expect(hasAuditDetail(event)).toBe(true);
	});

	it('marks updates without diff as legacy', () => {
		const event = eventOf({
			action: 'update',
			changes: { notes: { old: null, new: 'vieja' } }
		});
		expect(event.legacyUpdate).toBe(true);
		expect(event.itemsDiff).toBeNull();
		expect(event.totalDelta).toBeNull();
		expect(event.changeCount).toBe(0);
	});

	it('hides diff-covered fields from the legacy rows when a diff is present', () => {
		const event = eventOf({
			action: 'update',
			changes: {
				total: { old: 100, new: 120 },
				customerId: { old: 'a', new: 'b' },
				itemsDiff: { old: null, new: diff }
			}
		});
		const rows = auditDiffRows(event);
		// total lives in TOTALES; customerId is not covered by the diff.
		expect(rows.map((r) => r.field)).toEqual(['customerId']);
	});

	it('rejects malformed diff payloads as legacy', () => {
		const event = eventOf({
			action: 'update',
			changes: { itemsDiff: { old: null, new: { v: 2 } } }
		});
		expect(event.itemsDiff).toBeNull();
		expect(event.legacyUpdate).toBe(true);
	});

	it('computes a negative total delta', () => {
		expect(
			saleAuditTotalDelta({
				v: 1,
				items: [],
				header: [],
				totals: [{ label: 'Total', from: 120, to: 100 }]
			})
		).toBe(-20);
	});
});

describe('sale_payment events', () => {
	it('classifies payment registration with its BCV USD amount', () => {
		const event = classifySaleAuditEntry(
			entry({
				entityType: 'sale_payment',
				action: 'create',
				changes: {
					paymentMethod: { old: null, new: 'EFECTIVO_BS' },
					amountBcvUsd: { old: null, new: 45.5 }
				}
			})
		);
		expect(event).toMatchObject({
			label: 'Pago registrado',
			kind: 'payment',
			paymentAmount: 45.5
		});
	});

	it('classifies payment voids with the stored reason', () => {
		const event = classifySaleAuditEntry(
			entry({
				entityType: 'sale_payment',
				action: 'create',
				changes: {
					paymentMethod: { old: null, new: 'EFECTIVO_BS' },
					amountBcvUsd: { old: null, new: 45.5 }
				}
			})
		);
		expect(event).toMatchObject({
			label: 'Pago registrado',
			kind: 'payment',
			paymentAmount: 45.5
		});
	});

	it('classifies payment voids with the stored reason', () => {
		const event = classifySaleAuditEntry(
			entry({
				entityType: 'sale_payment',
				action: 'update',
				changes: {
					voidedAt: { old: null, new: '2026-11-07T12:00:00.000Z' },
					voidReason: { old: null, new: 'cobro duplicado' },
					amountBcvUsd: { old: 45.5, new: 45.5 }
				}
			})
		);
		expect(event).toMatchObject({
			label: 'Pago anulado',
			kind: 'paymentVoid',
			reason: 'cobro duplicado',
			paymentAmount: 45.5
		});
	});

	it('ignores non-void payment updates', () => {
		expect(
			classifySaleAuditEntry(
				entry({
					entityType: 'sale_payment',
					action: 'update',
					changes: { notes: { old: null, new: 'x' } }
				})
			)
		).toBeNull();
	});
});

describe('matchesAuditFilter', () => {
	function kindEvent(kind: AuditEvent['kind']): AuditEvent {
		return { kind } as AuditEvent;
	}

	it('splits Todos / Ediciones / Estados', () => {
		expect(matchesAuditFilter(kindEvent('create'), 'all')).toBe(true);
		expect(matchesAuditFilter(kindEvent('update'), 'edits')).toBe(true);
		expect(matchesAuditFilter(kindEvent('payment'), 'edits')).toBe(true);
		expect(matchesAuditFilter(kindEvent('paymentVoid'), 'edits')).toBe(true);
		expect(matchesAuditFilter(kindEvent('status'), 'edits')).toBe(false);
		expect(matchesAuditFilter(kindEvent('status'), 'states')).toBe(true);
		expect(matchesAuditFilter(kindEvent('cancel'), 'states')).toBe(true);
		expect(matchesAuditFilter(kindEvent('create'), 'states')).toBe(false);
		expect(matchesAuditFilter(kindEvent('update'), 'states')).toBe(false);
	});
});
