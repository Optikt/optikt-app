import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { createSaleCore } from './createSale';
import { updateSaleCore } from './updateSale';
import { saveSaleItemGroupsCore } from './saveSaleItemGroups';
import { db } from '$lib/server/db';
import { changeHistory, prescriptions, saleItems, sales } from '$lib/server/db/schema';
import { findSaleItemGroups } from '$lib/server/db/queries/sales/itemGroups';
import { resetDb } from '$lib/testing/integration/db';
import { createCustomer, createUser } from '$lib/testing/integration/factories';
import { DiscountType, SaleStatus, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { ActionContext } from '$lib/server/actionContext';
import type { CreateSaleInput, SaleItemInput } from '$lib/schemas/sales';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

function lens(odSphere: number): SaleItemInput {
	return {
		id: crypto.randomUUID(),
		itemType: SaleItemType.LENS_PAIR,
		quantity: 1,
		unitPrice: 50,
		discount: 0,
		discountType: DiscountType.FIXED,
		snapshotName: `Cristal ${odSphere}`,
		odSphere,
		osSphere: odSphere
	};
}

const rx = {
	prescriptionDate: '2026-11-20',
	odSphere: -1,
	osSphere: -1,
	treatmentAntiReflective: false,
	treatmentBlueBlock: false,
	treatmentPhotochromic: false,
	recommendedLensType: 'MONOFOCAL',
	doctorName: 'Dra. Ruiz',
	isCurrent: true
} as unknown as CreateSaleInput['prescription'];

async function seed() {
	const admin = await createUser({ role: UserRole.ADMIN });
	const customer = await createCustomer();
	return { admin, customer };
}

async function currentRx(customerId: string) {
	return db
		.select()
		.from(prescriptions)
		.where(
			and(
				eq(prescriptions.customerId, customerId),
				eq(prescriptions.isCurrent, true),
				isNull(prescriptions.deletedAt)
			)
		);
}

describe('sale item groups', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('create: saves groups and links ONLY the primary lens to the new current Rx', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const b = lens(-3);
		const result = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				prescription: rx,
				items: [a, b],
				groups: [
					{ label: 'Sofía', members: [{ itemId: a.id!, quantity: 1 }] },
					{ label: null, members: [{ itemId: b.id!, quantity: 1 }] }
				],
				primaryLensItemId: a.id
			},
			ctx(admin.id)
		);
		if (!result.success) throw new Error(result.error);

		const groups = await findSaleItemGroups(result.sale.id);
		expect(groups.map((g) => g.label)).toEqual(['Sofía', null]);
		expect(groups[0].members).toEqual([{ itemId: a.id, quantity: 1 }]);

		const [saleRow] = await db.select().from(sales).where(eq(sales.id, result.sale.id));
		expect(saleRow.primaryLensItemId).toBe(a.id);

		const current = await currentRx(customer.id);
		expect(current).toHaveLength(1);
		const lines = await db.select().from(saleItems).where(eq(saleItems.saleId, result.sale.id));
		expect(lines.find((l) => l.id === a.id)?.prescriptionId).toBe(current[0].id);
		expect(lines.find((l) => l.id === b.id)?.prescriptionId).toBeNull();
	});

	it('create: without a primary (several lenses) creates and overwrites no prescription', async () => {
		const { admin, customer } = await seed();
		const result = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				prescription: rx,
				items: [lens(-1), lens(-2)],
				primaryLensItemId: null
			},
			ctx(admin.id)
		);
		expect(result.success).toBe(true);
		expect(await currentRx(customer.id)).toHaveLength(0);
	});

	it('update: item replacement remaps groups and the primary to the new line ids', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const created = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				items: [a],
				groups: [{ label: 'Sofía', members: [{ itemId: a.id!, quantity: 1 }] }],
				primaryLensItemId: a.id
			},
			ctx(admin.id)
		);
		if (!created.success) throw new Error(created.error);

		const updated = await updateSaleCore(
			{ id: created.sale.id, reason: 'precio', items: [{ ...a, unitPrice: 60 }] },
			ctx(admin.id)
		);
		if (!updated.success) throw new Error(updated.error);

		const [live] = await db
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, created.sale.id), isNull(saleItems.deletedAt)));
		const groups = await findSaleItemGroups(created.sale.id);
		expect(groups[0].members).toEqual([{ itemId: live.id, quantity: 1 }]);
		const [saleRow] = await db.select().from(sales).where(eq(sales.id, created.sale.id));
		expect(saleRow.primaryLensItemId).toBe(live.id);
	});

	async function createWithPrimary(customerId: string, userId: string, a: SaleItemInput) {
		const created = await createSaleCore(
			{
				customerId,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				items: [a],
				primaryLensItemId: a.id
			},
			ctx(userId)
		);
		if (!created.success) throw new Error(created.error);
		return created.sale.id;
	}

	it('header-only update: rejects a primary that is not a live lens line', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const saleId = await createWithPrimary(customer.id, admin.id, a);

		const result = await updateSaleCore(
			{ id: saleId, reason: 'x', primaryLensItemId: crypto.randomUUID() },
			ctx(admin.id)
		);
		expect(result.success).toBe(false);
		const [saleRow] = await db.select().from(sales).where(eq(sales.id, saleId));
		expect(saleRow.primaryLensItemId).toBe(a.id);
	});

	it('update: editing the primary lens graduation refreshes the current Rx', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const saleId = await createWithPrimary(customer.id, admin.id, a);

		const updated = await updateSaleCore(
			{ id: saleId, reason: 'graduación', items: [{ ...a, odSphere: -1.5, osSphere: -1.5 }] },
			ctx(admin.id)
		);
		if (!updated.success) throw new Error(updated.error);

		const current = await currentRx(customer.id);
		expect(current).toHaveLength(1);
		expect(current[0].odSphere).toBe(-1.5);
	});

	it('update: moving the sale to another customer gives them the primary Rx', async () => {
		const { admin, customer } = await seed();
		const other = await createCustomer();
		const saleId = await createWithPrimary(customer.id, admin.id, lens(-2));

		const updated = await updateSaleCore(
			{ id: saleId, reason: 'cliente', customerId: other.id },
			ctx(admin.id)
		);
		if (!updated.success) throw new Error(updated.error);

		const current = await currentRx(other.id);
		expect(current).toHaveLength(1);
		expect(current[0].odSphere).toBe(-2);
	});

	it('groups-only save: allowed on COMPLETED, rejected on CANCELLED and over-allocation', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const b = lens(-4);
		const created = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				items: [a, b],
				primaryLensItemId: null
			},
			ctx(admin.id)
		);
		if (!created.success) throw new Error(created.error);
		const saleId = created.sale.id;
		await db.update(sales).set({ status: SaleStatus.COMPLETED }).where(eq(sales.id, saleId));
		const totalBefore = created.sale.total;

		const ok = await saveSaleItemGroupsCore(
			{
				saleId,
				groups: [{ label: 'Andrés', members: [{ itemId: b.id!, quantity: 1 }] }],
				primaryLensItemId: b.id!
			},
			ctx(admin.id)
		);
		expect(ok.success).toBe(true);
		const current = await currentRx(customer.id);
		expect(current).toHaveLength(1);
		expect(current[0].odSphere).toBe(-4);
		const [saleRow] = await db.select().from(sales).where(eq(sales.id, saleId));
		expect(saleRow.total).toBe(totalBefore);

		const over = await saveSaleItemGroupsCore(
			{
				saleId,
				groups: [{ label: null, members: [{ itemId: a.id!, quantity: 2 }] }],
				primaryLensItemId: null
			},
			ctx(admin.id)
		);
		expect(over.success).toBe(false);

		await db.update(sales).set({ status: SaleStatus.CANCELLED }).where(eq(sales.id, saleId));
		const cancelled = await saveSaleItemGroupsCore(
			{ saleId, groups: [], primaryLensItemId: null },
			ctx(admin.id)
		);
		expect(cancelled.success).toBe(false);
	});

	it('audit: header-only primary change logs primaryLens without an empty itemsDiff', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const b = lens(-2);
		const created = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				items: [a, b],
				primaryLensItemId: a.id
			},
			ctx(admin.id)
		);
		if (!created.success) throw new Error(created.error);

		const res = await updateSaleCore(
			{ id: created.sale.id, reason: 'cambio principal', primaryLensItemId: b.id },
			ctx(admin.id)
		);
		expect(res.success).toBe(true);

		const events = await db
			.select()
			.from(changeHistory)
			.where(and(eq(changeHistory.entityId, created.sale.id), eq(changeHistory.action, 'update')));
		expect(events).toHaveLength(1);
		const changes = events[0].changes as Record<string, unknown>;
		expect(changes.primaryLens).toEqual({ old: 'Cristal -1', new: 'Cristal -2' });
		expect(changes.itemsDiff).toBeUndefined();
	});

	it('audit: item replacement that removes primary lens logs X → Ninguna', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1);
		const b = lens(-2);
		const created = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				items: [a, b],
				primaryLensItemId: a.id
			},
			ctx(admin.id)
		);
		if (!created.success) throw new Error(created.error);

		const updated = await updateSaleCore(
			{ id: created.sale.id, reason: 'quitar cristal a', items: [b], primaryLensItemId: null },
			ctx(admin.id)
		);
		expect(updated.success).toBe(true);

		const events = await db
			.select()
			.from(changeHistory)
			.where(and(eq(changeHistory.entityId, created.sale.id), eq(changeHistory.action, 'update')));
		expect(events).toHaveLength(1);
		const changes = events[0].changes as Record<string, unknown>;
		expect(changes.primaryLens).toEqual({ old: 'Cristal -1', new: 'Ninguna' });
	});

	it('update: customer change with DP/NP measures never mutates old customer Rx and applies them to new customer', async () => {
		const { admin, customer } = await seed();
		const other = await createCustomer();
		const a = lens(-2);
		const saleId = await createWithPrimary(customer.id, admin.id, a);
		const [oldRxBefore] = await currentRx(customer.id);

		const updated = await updateSaleCore(
			{
				id: saleId,
				reason: 'cambio cliente y medidas',
				customerId: other.id,
				prescription: { dp: 64, npRight: 32, npLeft: 32 }
			},
			ctx(admin.id)
		);
		expect(updated.success).toBe(true);

		const [oldRxAfter] = await currentRx(customer.id);
		expect(oldRxAfter.dp).toBe(oldRxBefore.dp);
		const [newCustomerRx] = await currentRx(other.id);
		expect(newCustomerRx.odSphere).toBe(-2);
		expect(newCustomerRx.dp).toBe(64);
		expect(newCustomerRx.npRight).toBe(32);
	});

	it('update: setting a new primary lens + DP/NP when no prior Rx existed creates one with measures', async () => {
		const { admin, customer } = await seed();
		const a = lens(-1.5);
		const created = await createSaleCore(
			{
				customerId: customer.id,
				saleDate: '2026-11-20',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				items: [a],
				primaryLensItemId: null
			},
			ctx(admin.id)
		);
		if (!created.success) throw new Error(created.error);

		const updated = await updateSaleCore(
			{
				id: created.sale.id,
				reason: 'marcar principal y dp',
				primaryLensItemId: a.id,
				prescription: { dp: 62 }
			},
			ctx(admin.id)
		);
		expect(updated.success).toBe(true);
		const [rxAfter] = await currentRx(customer.id);
		expect(rxAfter.odSphere).toBe(-1.5);
		expect(rxAfter.dp).toBe(62);
	});

	it('saveSaleItemGroupsCore: rejects VIEWER and non-owner SELLER', async () => {
		const seller = await createUser({ role: UserRole.SELLER });
		const otherSeller = await createUser({ role: UserRole.SELLER });
		const viewer = await createUser({ role: UserRole.VIEWER });
		const customer = await createCustomer();
		const a = lens(-1);
		const saleId = await createWithPrimary(customer.id, seller.id, a);

		const byViewer = await saveSaleItemGroupsCore(
			{ saleId, groups: [], primaryLensItemId: null },
			{ userId: viewer.id, role: UserRole.VIEWER, ipAddress: '127.0.0.1', userAgent: null }
		);
		expect(byViewer.success).toBe(false);

		const byOther = await saveSaleItemGroupsCore(
			{ saleId, groups: [], primaryLensItemId: null },
			{ userId: otherSeller.id, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null }
		);
		expect(byOther.success).toBe(false);
	});
});
