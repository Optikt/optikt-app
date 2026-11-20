import { beforeEach, describe, expect, it } from 'vitest';
import { createSaleCore } from './createSale';
import { updateSaleCore } from './updateSale';
import { db } from '$lib/server/db';
import { sales } from '$lib/server/db/schema';
import { getSaleOrderNumberPreview } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createInventoryLot,
	createMaterial,
	createProduct,
	createSale,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { DiscountType } from '$lib/shared/enums/salesTypes';
import { UserRole } from '$lib/shared/enums/roles';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { ActionContext } from '$lib/server/actionContext';
import type { CreateSaleInput } from '$lib/schemas/sales';

function ctx(userId: string, role: UserRole = UserRole.ADMIN): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

async function seed(stock = 100) {
	const admin = await createUser({ role: UserRole.ADMIN });
	const customer = await createCustomer();
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({ supplierId: supplier.id, materialId: material.id, stock });
	await createInventoryLot({
		productId: product.id,
		quantityInitial: stock,
		quantityAvailable: stock,
		unitPurchasePrice: 5,
		unitSalePrice: 20
	});
	const input = (orderNumber?: number): CreateSaleInput => ({
		customerId: customer.id,
		saleDate: '2026-11-19',
		...(orderNumber !== undefined && { orderNumber }),
		discount: 0,
		discountType: DiscountType.FIXED,
		snapshotTaxRate: 16,
		items: [
			{
				itemType: SaleItemType.PRODUCT,
				productId: product.id,
				quantity: 1,
				unitPrice: 20,
				discount: 0,
				discountType: DiscountType.FIXED
			}
		]
	});
	return { admin, input };
}

async function create(input: CreateSaleInput, c: ActionContext): Promise<number> {
	const result = await createSaleCore(input, c);
	if (!result.success) throw new Error(result.error);
	return result.sale.orderNumber;
}

describe('numeración de ventas por sequence (sales_order_number_seq)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('asigna números únicos y consecutivos a N ventas creadas en paralelo', async () => {
		const { admin, input } = await seed();
		const N = 10;

		const numbers = await Promise.all(
			Array.from({ length: N }, () => create(input(), ctx(admin.id)))
		);

		expect(new Set(numbers).size).toBe(N);
		expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: N }, (_, i) => i + 1));
	});

	it('caso sin luz: salto manual a #210, automáticas siguen en #211, backfill #201–#209 no mueve la sequence', async () => {
		const { admin, input } = await seed();
		// Sistema venía numerando automático
		expect(await create(input(), ctx(admin.id))).toBe(1);

		// Vuelve la luz: el admin salta al #210 (#201–#209 quedaron en papel)
		expect(await create(input(210), ctx(admin.id))).toBe(210);
		expect(await getSaleOrderNumberPreview()).toBe(211);
		expect(await create(input(), ctx(admin.id))).toBe(211);
		expect(await create(input(), ctx(admin.id))).toBe(212);

		// Después carga las de papel: números menores, la sequence no se mueve
		for (const n of [201, 202, 209]) {
			expect(await create(input(n), ctx(admin.id))).toBe(n);
		}
		expect(await getSaleOrderNumberPreview()).toBe(213);
		expect(await create(input(), ctx(admin.id))).toBe(213);

		// El hueco no se rellena solo: #203–#208 siguen libres
		const rows = await db.select({ n: sales.orderNumber }).from(sales);
		const used = new Set(rows.map((r) => r.n));
		for (let n = 203; n <= 208; n++) expect(used.has(n)).toBe(false);
	});

	it('rechaza un número manual repetido con mensaje claro y sin crear la venta', async () => {
		const { admin, input } = await seed();
		await create(input(50), ctx(admin.id));

		await expect(createSaleCore(input(50), ctx(admin.id))).rejects.toThrow(
			'El número de orden #50 ya existe'
		);
		expect(await db.select().from(sales)).toHaveLength(1);
	});

	it('una automática que cae en un número ya ocupado toma el siguiente libre', async () => {
		const { admin, input } = await seed();
		// Filas con número explícito que NO pasaron por bumpSaleOrderSequence
		// (p. ej. datos importados): ocupan los próximos valores de la sequence
		await createSale({ orderNumber: 1 });
		await createSale({ orderNumber: 2 });

		expect(await create(input(), ctx(admin.id))).toBe(3);
	});

	it('el preview no reserva números', async () => {
		const { admin, input } = await seed();
		expect(await getSaleOrderNumberPreview()).toBe(1);
		expect(await getSaleOrderNumberPreview()).toBe(1);
		expect(await create(input(), ctx(admin.id))).toBe(1);
		expect(await getSaleOrderNumberPreview()).toBe(2);
	});

	it('reasignar un número (admin, updateSale) por encima de la sequence la sube', async () => {
		const { admin, input } = await seed();
		const result = await createSaleCore(input(), ctx(admin.id));
		if (!result.success) throw new Error(result.error);

		const updated = await updateSaleCore(
			{ id: result.sale.id, reason: 'renumerar', orderNumber: 500 },
			ctx(admin.id)
		);
		expect(updated.success).toBe(true);
		expect(await create(input(), ctx(admin.id))).toBe(501);
	});

	it('dos números manuales en paralelo (#211 y #215) dejan la sequence en 216', async () => {
		const { admin, input } = await seed();

		await Promise.all([create(input(211), ctx(admin.id)), create(input(215), ctx(admin.id))]);

		expect(await getSaleOrderNumberPreview()).toBe(216);
		expect(await create(input(), ctx(admin.id))).toBe(216);
	});

	it('reasignar a una venta su propio número no es un duplicado', async () => {
		const { admin, input } = await seed();
		const result = await createSaleCore(input(), ctx(admin.id));
		if (!result.success) throw new Error(result.error);

		const updated = await updateSaleCore(
			{ id: result.sale.id, reason: 'sin cambio', orderNumber: result.sale.orderNumber },
			ctx(admin.id)
		);
		expect(updated.success).toBe(true);
	});
});
