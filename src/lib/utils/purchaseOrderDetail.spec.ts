import { describe, expect, it } from 'vitest';
import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import type { ChangeRecord } from '$lib/server/db/schema';
import { classifyAuditEntry } from './purchaseOrderDetail';

function makeEntry(
	entityType: string,
	action: string,
	changes: ChangeRecord,
	overrides: Partial<ChangeHistoryWithUser> = {}
): ChangeHistoryWithUser {
	return {
		id: 'h-1',
		entityType,
		entityId: 'po-1',
		action,
		changes,
		createdAt: '2026-08-01T11:59:00.000Z',
		changedAt: '2026-08-01T12:00:00.000Z',
		changedById: 'u-1',
		snapshot: null,
		reason: null,
		ipAddress: null,
		userAgent: null,
		changedByName: 'Juan Pérez',
		...overrides
	};
}

describe('classifyAuditEntry', () => {
	it('classifies purchase order creation', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'create', { id: { old: null, new: 'po-1' } })
		);
		expect(event?.label).toBe('Orden creada');
	});

	it('classifies status transition to CONFIRMED', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				status: { old: 'DRAFT', new: 'CONFIRMED' }
			})
		);
		expect(event?.label).toBe('Orden confirmada');
	});

	it('classifies status transition to CANCELLED', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				status: { old: 'DRAFT', new: 'CANCELLED' }
			})
		);
		expect(event?.label).toBe('Orden cancelada');
	});

	it('classifies status transition back to DRAFT', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				status: { old: 'CONFIRMED', new: 'DRAFT' }
			})
		);
		expect(event?.label).toBe('Orden devuelta a borrador');
	});

	it('classifies isReadyForReview true as sent to review', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				isReadyForReview: { old: false, new: true }
			})
		);
		expect(event?.label).toBe('Enviada a revisión');
	});

	it('classifies isReadyForReview false as returned to draft', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				isReadyForReview: { old: true, new: false }
			})
		);
		expect(event?.label).toBe('Devuelta a borrador');
	});

	it('classifies payment terms update', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				paymentTerms: { old: 'CONTADO', new: 'CREDIT' }
			})
		);
		expect(event?.label).toBe('Términos de pago actualizados');
	});

	it('classifies payment registration', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order_payment', 'create', {
				amount: { old: null, new: 100 }
			})
		);
		expect(event?.label).toBe('Pago registrado');
	});

	it('classifies payment void', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order_payment', 'update', {
				voidedAt: { old: null, new: '2026-08-01T12:00:00.000Z' }
			})
		);
		expect(event?.label).toBe('Pago anulado');
	});

	it('returns null for unrelated draft field changes', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order', 'update', {
				notes: { old: 'a', new: 'b' }
			})
		);
		expect(event).toBeNull();
	});

	it('returns null for unsupported entity types', () => {
		const event = classifyAuditEntry(
			makeEntry('purchase_order_item', 'update', {
				isReviewed: { old: false, new: true }
			})
		);
		expect(event).toBeNull();
	});
});
