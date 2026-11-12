import { describe, expect, it } from 'vitest';
import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import { formatPrice } from '$lib/utils';
import {
	auditDiffRows,
	classifySaleAuditEntry,
	hasAuditDetail,
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
});
