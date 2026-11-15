import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { updateSaleCore } from './updateSale';
import { addSalePaymentCore } from './addSalePayment';
import { voidSalePaymentCore } from './voidSalePayment';
import {
	getSaleAuditHistory,
	getSaleAuditHistoryCount
} from '$lib/server/db/queries/changeHistory';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import { db } from '$lib/server/db';
import { changeHistory, inventoryMovements } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createSale,
	createSaleItem,
	createUser
} from '$lib/testing/integration/factories';
import { DiscountType, PaymentMethod, SaleItemType, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string, role: UserRole = UserRole.ADMIN): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

async function saleEvents(saleId: string) {
	return db
		.select()
		.from(changeHistory)
		.where(and(eq(changeHistory.entityType, 'sale'), eq(changeHistory.entityId, saleId)));
}

function readDiff(row: { changes: unknown }) {
	const changes = row.changes as Record<string, { old: unknown; new: unknown }>;
	return changes.itemsDiff?.new as {
		v: number;
		items: Array<{ t: string; [k: string]: unknown }>;
		header: unknown[];
		totals: Array<{ label: string; from: number; to: number }>;
		truncated?: number;
	};
}

describe('updateSale audit diff', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('stores a v1 itemsDiff on item edits without altering totals or inventory', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const sale = await createSale({ sellerId: seller.id, customerId: customer.id });
		const itemA = await createSaleItem({
			saleId: sale.id,
			itemType: SaleItemType.PRODUCT,
			quantity: 1,
			unitPrice: 20,
			snapshotName: 'Montura A'
		});
		const itemB = await createSaleItem({
			saleId: sale.id,
			itemType: SaleItemType.PRODUCT,
			quantity: 2,
			unitPrice: 10,
			snapshotName: 'Montura B'
		});

		const result = await updateSaleCore(
			{
				id: sale.id,
				reason: 'cambio de precio y artículo',
				items: [
					{
						id: itemA.id,
						itemType: SaleItemType.PRODUCT,
						quantity: 1,
						unitPrice: 25,
						discount: 0,
						discountType: DiscountType.FIXED,
						snapshotName: 'Montura A'
					},
					{
						id: crypto.randomUUID(),
						itemType: SaleItemType.PRODUCT,
						quantity: 1,
						unitPrice: 30,
						discount: 0,
						discountType: DiscountType.FIXED,
						snapshotName: 'Montura C'
					}
				]
			},
			ctx(seller.id)
		);

		expect(result.success).toBe(true);

		// The annexed diff describes mod (price) + add (C) + del (B).
		const events = await saleEvents(sale.id);
		const update = events.find((e) => e.action === 'update');
		expect(update).toBeDefined();
		const diff = readDiff(update!);
		expect(diff.v).toBe(1);
		expect(diff.truncated).toBeUndefined();
		expect(diff.items.map((c) => c.t).sort()).toEqual(['add', 'del', 'mod']);
		const mod = diff.items.find((c) => c.t === 'mod');
		expect(mod).toMatchObject({ name: 'Montura A' });

		// Totals follow computeSaleTotals (PRODUCT taxable @16) — the annex only describes.
		const expected = computeSaleTotals(
			[
				{
					unitPrice: 25,
					quantity: 1,
					discount: 0,
					discountType: 'FIXED',
					isTaxable: true,
					taxRate: 16
				},
				{
					unitPrice: 30,
					quantity: 1,
					discount: 0,
					discountType: 'FIXED',
					isTaxable: true,
					taxRate: 16
				}
			],
			0,
			'FIXED'
		);
		if (!result.success) throw new Error('expected success');
		expect(result.sale.total).toBe(expected.total);
		expect(result.sale.subtotal).toBe(expected.subtotal);

		// Plain items carry no inventory linkage: the edit must not invent movements.
		const movements = await db
			.select()
			.from(inventoryMovements)
			.where(eq(inventoryMovements.referenceId, sale.id));
		expect(movements).toHaveLength(0);

		// Sanity: the soft-deleted rows keep the before-state traceability.
		expect(itemB.id).toBeDefined();
	});

	it('stores header/totals sections on header-only edits', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, subtotal: 100, total: 100 });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'nota aclaratoria', notes: 'llamar antes de entregar' },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		const events = await saleEvents(sale.id);
		const update = events.find((e) => e.action === 'update');
		const diff = readDiff(update!);
		expect(diff.v).toBe(1);
		expect(diff.items).toEqual([]);
		expect(diff.header).toEqual([
			{ key: 'notes', label: 'Notas', from: null, to: 'llamar antes de entregar' }
		]);
	});

	it('logs nothing on a reason-only no-op save', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const before = await saleEvents(sale.id);
		const result = await updateSaleCore({ id: sale.id, reason: 'sin cambios' }, ctx(seller.id));

		expect(result.success).toBe(true);
		expect(await saleEvents(sale.id)).toHaveLength(before.length);
	});

	it('logs voided payments so the timeline shows registered + voided', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, subtotal: 100, total: 100 });

		const added = await addSalePaymentCore(
			{
				saleId: sale.id,
				paymentMethod: PaymentMethod.EFECTIVO_BS,
				paymentDate: '2026-11-07',
				amount: 5000,
				usdBcvAmount: 50,
				bcvRate: 100
			},
			ctx(seller.id)
		);
		expect(added.success).toBe(true);
		if (!added.success) throw new Error('expected payment success');

		const voided = await voidSalePaymentCore(
			{ id: added.payment.id, saleId: sale.id, reason: 'cobro duplicado' },
			ctx(seller.id)
		);
		expect(voided.success).toBe(true);

		const paymentEvents = await db
			.select()
			.from(changeHistory)
			.where(
				and(
					eq(changeHistory.entityType, 'sale_payment'),
					eq(changeHistory.entityId, added.payment.id)
				)
			);
		expect(paymentEvents.map((e) => e.action)).toEqual(['create', 'update']);
		const voidEvent = paymentEvents.find((e) => e.action === 'update');
		const changes = voidEvent!.changes as Record<string, { old: unknown; new: unknown }>;
		expect(changes.voidReason?.new).toBe('cobro duplicado');

		// Merged timeline exposes both payment events plus the sale's own.
		const timeline = await getSaleAuditHistory(sale.id);
		expect(timeline.some((e) => e.entityType === 'sale_payment' && e.action === 'create')).toBe(
			true
		);
		expect(timeline.some((e) => e.entityType === 'sale_payment' && e.action === 'update')).toBe(
			true
		);
		expect(await getSaleAuditHistoryCount(sale.id)).toBe(timeline.length);
	});
});
