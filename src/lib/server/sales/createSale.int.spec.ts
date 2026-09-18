import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSaleCore } from './createSale';
import { db } from '$lib/server/db';
import {
	inventoryLots,
	products,
	saleItemFreeDetails,
	saleItems,
	sales
} from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createInventoryLot,
	createMaterial,
	createProduct,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType, FreeItemCategory } from '$lib/shared/enums/lensTypes';
import type { ActionContext } from '$lib/server/actionContext';
import type { CreateSaleInput, SaleItemInput } from '$lib/schemas/sales';

function ctx(userId: string, role: UserRole = UserRole.ADMIN): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

function item(productId: string): SaleItemInput {
	return {
		itemType: SaleItemType.PRODUCT,
		productId,
		quantity: 2,
		unitPrice: 20,
		discount: 0,
		discountType: DiscountType.FIXED
	};
}

async function seedSaleInput(stock = 10) {
	const admin = await createUser({ role: UserRole.ADMIN });
	const customer = await createCustomer();
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock
	});
	const lot = await createInventoryLot({
		productId: product.id,
		quantityInitial: stock,
		quantityAvailable: stock,
		unitPurchasePrice: 5,
		unitSalePrice: 20
	});
	return { admin, customer, product, lot };
}

function treatmentItem(overrides: Partial<SaleItemInput> = {}): SaleItemInput {
	return {
		itemType: SaleItemType.TREATMENT,
		quantity: 1,
		unitPrice: 10,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	};
}

describe('createSaleCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('creates a sale, consumes the FIFO lot and decrements cached stock', async () => {
		const { admin, customer, product, lot } = await seedSaleInput();
		const input: CreateSaleInput = {
			customerId: customer.id,
			saleDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('sale was not created');

		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		const [lotAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id));
		const items = await db.select().from(saleItems).where(eq(saleItems.saleId, result.sale.id));

		expect(productAfter.stock).toBe(8);
		expect(lotAfter.quantityAvailable).toBe(8);
		expect(items).toHaveLength(1);
		expect(items[0].lotId).toBe(lot.id);
		expect(items[0].quantity).toBe(2);
	});

	it('creates an inline customer when none exists', async () => {
		const { admin, product } = await seedSaleInput();
		const input: CreateSaleInput = {
			newCustomer: {
				firstName: 'Ana',
				lastName: 'Pérez',
				idNumber: 'V-12345678'
			},
			saleDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('sale was not created');
		expect(result.sale.customerId).toBeTruthy();
	});

	it('blocks a non-admin from assigning a custom order number', async () => {
		const { admin, customer, product } = await seedSaleInput();
		const input: CreateSaleInput = {
			customerId: customer.id,
			orderNumber: 999,
			saleDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};

		const result = await createSaleCore(input, ctx(admin.id, UserRole.SELLER));

		expect(result).toEqual({
			success: false,
			error: 'Solo administradores pueden asignar un número de orden'
		});
	});

	it('rejects a sale without a customer', async () => {
		const { admin, product } = await seedSaleInput();
		const input: CreateSaleInput = {
			saleDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({
			success: false,
			error: 'Debe seleccionar o crear un cliente'
		});
	});
});

describe('createSaleCore — validation branches', () => {
	beforeEach(async () => {
		await resetDb();
	});

	async function baseInput(productId: string): Promise<CreateSaleInput> {
		const { customer } = await seedSaleInput();
		return {
			customerId: customer.id,
			saleDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(productId)]
		};
	}

	it('returns not found for an unknown existing customer', async () => {
		const { admin, product } = await seedSaleInput();
		const input = { ...(await baseInput(product.id)), customerId: crypto.randomUUID() };

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({ success: false, error: 'Cliente no encontrado' });
	});

	it('rejects an inline customer whose document already exists', async () => {
		const { admin, product } = await seedSaleInput();
		await createCustomer({ idNumber: 'V-87654321' });
		const base = await baseInput(product.id);
		const input: CreateSaleInput = {
			...base,
			customerId: undefined,
			newCustomer: { firstName: 'Ana', lastName: 'Pérez', idNumber: 'v-87654321' }
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({
			success: false,
			error: 'Ya existe un cliente con ese documento'
		});
	});

	it('requires a parent for TREATMENT items', async () => {
		const { admin, product } = await seedSaleInput();
		const input: CreateSaleInput = {
			...(await baseInput(product.id)),
			items: [treatmentItem({ supplierTreatmentId: crypto.randomUUID() })]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({
			success: false,
			error: 'Tratamiento requiere un ítem de lente padre'
		});
	});

	it('rejects a TREATMENT whose parent is not a LENS_PAIR item', async () => {
		const { admin, product } = await seedSaleInput();
		const input: CreateSaleInput = {
			...(await baseInput(product.id)),
			items: [
				treatmentItem({
					parentSaleItemId: crypto.randomUUID(),
					supplierTreatmentId: crypto.randomUUID()
				})
			]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({
			success: false,
			error: 'Tratamiento referencia un ítem padre que no es tipo LENS_PAIR'
		});
	});

	it('requires a supplier treatment id', async () => {
		const { admin, product } = await seedSaleInput();
		const lensItem: SaleItemInput = {
			id: crypto.randomUUID(),
			itemType: SaleItemType.LENS_PAIR,
			lensCatalogItemId: crypto.randomUUID(),
			quantity: 1,
			unitPrice: 100,
			discount: 0,
			discountType: DiscountType.FIXED
		};
		const input: CreateSaleInput = {
			...(await baseInput(product.id)),
			items: [lensItem, treatmentItem({ parentSaleItemId: lensItem.id })]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({
			success: false,
			error: 'Tratamiento requiere un supplierTreatmentId'
		});
	});

	it('rejects a TREATMENT whose parent lens does not exist', async () => {
		const { admin, product } = await seedSaleInput();
		const lensItem: SaleItemInput = {
			id: crypto.randomUUID(),
			itemType: SaleItemType.LENS_PAIR,
			lensCatalogItemId: crypto.randomUUID(),
			quantity: 1,
			unitPrice: 100,
			discount: 0,
			discountType: DiscountType.FIXED
		};
		const input: CreateSaleInput = {
			...(await baseInput(product.id)),
			items: [
				lensItem,
				treatmentItem({
					parentSaleItemId: lensItem.id,
					supplierTreatmentId: crypto.randomUUID()
				})
			]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result).toEqual({ success: false, error: 'Lente padre no encontrado' });
	});

	it('creates a FREE_ITEM with its free details row', async () => {
		const { admin, product } = await seedSaleInput();
		const input: CreateSaleInput = {
			...(await baseInput(product.id)),
			items: [
				{
					itemType: SaleItemType.FREE_ITEM,
					quantity: 1,
					unitPrice: 10,
					discount: 0,
					discountType: DiscountType.FIXED,
					freeItemCategory: FreeItemCategory.SERVICE,
					freeItemDescription: 'Servicio de prueba'
				}
			]
		};

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('sale was not created');
		const [saleItem] = await db
			.select()
			.from(saleItems)
			.where(eq(saleItems.saleId, result.sale.id));
		const details = await db
			.select()
			.from(saleItemFreeDetails)
			.where(eq(saleItemFreeDetails.saleItemId, saleItem.id));
		expect(saleItem.itemType).toBe(SaleItemType.FREE_ITEM);
		expect(details).toHaveLength(1);
	});

	it('accepts a custom order number from an admin', async () => {
		const { admin, product } = await seedSaleInput();
		const input: CreateSaleInput = { ...(await baseInput(product.id)), orderNumber: 4242 };

		const result = await createSaleCore(input, ctx(admin.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('sale was not created');
		expect(result.sale.orderNumber).toBe(4242);
	});

	it('rejects a duplicated order number and rolls back', async () => {
		const { admin, product } = await seedSaleInput();
		const input = await baseInput(product.id);
		const first = await createSaleCore(input, ctx(admin.id));
		if (!first.success) throw new Error('sale was not created');

		await expect(
			createSaleCore({ ...input, orderNumber: first.sale.orderNumber }, ctx(admin.id))
		).rejects.toThrow('ya existe');

		const rows = await db.select().from(sales);
		expect(rows).toHaveLength(1);
	});

	it('rolls back when stock is insufficient', async () => {
		const { admin, customer, product } = await seedSaleInput(1);
		const input: CreateSaleInput = {
			customerId: customer.id,
			saleDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [{ ...item(product.id), quantity: 2 }]
		};

		await expect(createSaleCore(input, ctx(admin.id))).rejects.toThrow('Stock insuficiente');

		const rows = await db.select().from(sales);
		expect(rows).toHaveLength(0);
	});
});
