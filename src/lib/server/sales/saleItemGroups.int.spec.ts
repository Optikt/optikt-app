import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { createSaleCore } from './createSale';
import { updateSaleCore } from './updateSale';
import { saveSaleItemGroupsCore } from './saveSaleItemGroups';
import { db } from '$lib/server/db';
import { prescriptions, saleItems, sales } from '$lib/server/db/schema';
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
});
