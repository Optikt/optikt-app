import { beforeEach, describe, expect, it } from 'vitest';
import { updateSaleCore } from './updateSale';
import { findSaleById, getSalePrescription } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import {
	createSale,
	createCustomer,
	createSaleItem,
	createUser
} from '$lib/testing/integration/factories';
import { db } from '$lib/server/db';
import { prescriptions } from '$lib/server/db/schema';
import { DiscountType, SaleStatus, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string, role: UserRole = UserRole.ADMIN): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

describe('updateSaleCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('updates header fields without touching items', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'ajuste de nota', notes: 'nota actualizada' },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		const updated = await findSaleById(sale.id);
		expect(updated?.notes).toBe('nota actualizada');
	});

	it('blocks editing a COMPLETED sale', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, status: SaleStatus.COMPLETED });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'intento de edición', notes: 'x' },
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'No se puede modificar una venta completada'
		});
	});

	it('blocks a discount that drops the total below the paid amount', async () => {
		const seller = await createUser();
		const sale = await createSale({
			sellerId: seller.id,
			subtotal: 100,
			total: 100,
			paidAmountBcvUsd: 100
		});

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'descuento', discount: 50 },
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error:
				'La modificación reduce el total por debajo de lo ya cobrado. Por favor cancele esta venta y cree una nueva.'
		});
	});

	it('rejects an empty items array', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'sin items', items: [] },
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'La venta debe tener al menos un artículo'
		});
	});

	it('validates treatment items on update', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const result = await updateSaleCore(
			{
				id: sale.id,
				reason: 'tratamiento inválido',
				items: [
					{
						itemType: SaleItemType.TREATMENT,
						parentSaleItemId: crypto.randomUUID(),
						supplierTreatmentId: crypto.randomUUID(),
						quantity: 1,
						unitPrice: 10,
						discount: 0,
						discountType: DiscountType.FIXED
					}
				]
			},
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'Tratamiento referencia un ítem padre que no es tipo LENS_PAIR'
		});
	});

	/** Sale + linked prescription whose first non-deleted item may be a PRODUCT:
	 *  the prescription pivot must come from the lens item's link (inner join),
	 *  not from the first-row `prescriptionId` of the tx resolver. */
	async function saleWithPrescription(productFirst: boolean) {
		const seller = await createUser();
		const customer = await createCustomer();
		const sale = await createSale({ sellerId: seller.id, customerId: customer.id });
		const [prescription] = await db
			.insert(prescriptions)
			.values({ customerId: customer.id, prescriptionDate: new Date().toISOString(), dp: 62 })
			.returning();

		if (productFirst) {
			await createSaleItem({ saleId: sale.id, itemType: SaleItemType.PRODUCT });
			await createSaleItem({
				saleId: sale.id,
				itemType: SaleItemType.LENS_PAIR,
				prescriptionId: prescription.id
			});
		} else {
			await createSaleItem({
				saleId: sale.id,
				itemType: SaleItemType.LENS_PAIR,
				prescriptionId: prescription.id
			});
		}
		return { seller, sale };
	}

	it('patches the prescription even when the first sale item is a product', async () => {
		const { seller, sale } = await saleWithPrescription(true);

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'medidas corregidas', prescription: { dp: 64 } },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		const after = await getSalePrescription(sale.id);
		expect(after?.dp).toBe(64);
	});

	it('writes NULL when a measure is cleared (explicit null)', async () => {
		const { seller, sale } = await saleWithPrescription(false);

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'medida borrada', prescription: { dp: null } },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		expect((await getSalePrescription(sale.id))?.dp).toBeNull();
	});

	it('rejects a prescription patch on a sale without a prescription row', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });
		await createSaleItem({ saleId: sale.id, itemType: SaleItemType.LENS_PAIR });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'medidas sin receta', prescription: { dp: 62 } },
			ctx(seller.id)
		);

		expect(result.success).toBe(false);
	});

	it('a no-op save does not bump updatedAt on the sale', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });
		const before = await findSaleById(sale.id);

		const result = await updateSaleCore({ id: sale.id, reason: 'sin cambios' }, ctx(seller.id));

		expect(result.success).toBe(true);
		const after = await findSaleById(sale.id);
		expect(after?.updatedAt).toBe(before?.updatedAt);
	});
});
