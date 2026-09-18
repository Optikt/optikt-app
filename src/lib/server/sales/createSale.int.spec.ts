import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSaleCore } from './createSale';
import { db } from '$lib/server/db';
import { inventoryLots, products, saleItems } from '$lib/server/db/schema';
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
import { SaleItemType } from '$lib/shared/enums/lensTypes';
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

async function seedSaleInput() {
	const admin = await createUser({ role: UserRole.ADMIN });
	const customer = await createCustomer();
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock: 10
	});
	const lot = await createInventoryLot({
		productId: product.id,
		quantityInitial: 10,
		quantityAvailable: 10,
		unitPurchasePrice: 5,
		unitSalePrice: 20
	});
	return { admin, customer, product, lot };
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
