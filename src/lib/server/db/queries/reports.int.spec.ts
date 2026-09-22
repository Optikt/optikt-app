import { beforeEach, describe, expect, it } from 'vitest';
import { getReportSalesByBrand } from './reports';
import { resetDb } from '$lib/testing/integration/db';
import {
	createMaterial,
	createProduct,
	createSale,
	createSaleItem,
	createSupplier
} from '$lib/testing/integration/factories';
import { DiscountType, ProductType, SaleStatus } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

const today = new Date().toISOString().slice(0, 10);

async function createProductId(type: ProductType = ProductType.FRAME) {
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({ supplierId: supplier.id, materialId: material.id, type });
	return product.id;
}

describe('getReportSalesByBrand', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('groups frames and sunglasses by brand snapshot with net line totals', async () => {
		const rayBanId = await createProductId();
		const oakleyId = await createProductId(ProductType.SUNGLASSES);
		const sale = await createSale();
		await createSaleItem({
			saleId: sale.id,
			productId: rayBanId,
			snapshotBrand: 'Ray-Ban',
			quantity: 2,
			unitPrice: 100
		});
		await createSaleItem({
			saleId: sale.id,
			productId: rayBanId,
			snapshotBrand: 'Ray-Ban',
			quantity: 1,
			unitPrice: 100,
			discountType: DiscountType.FIXED,
			discount: 20
		});
		await createSaleItem({
			saleId: sale.id,
			productId: oakleyId,
			snapshotBrand: 'Oakley',
			quantity: 1,
			unitPrice: 50,
			discountType: DiscountType.PERCENTAGE,
			discount: 10
		});

		const result = await getReportSalesByBrand(today, today);

		expect(result).toEqual([
			{ brand: 'Ray-Ban', total: 280, salesCount: 1 },
			{ brand: 'Oakley', total: 45, salesCount: 1 }
		]);
	});

	it('excludes cancelled sales, non-product items and accessories', async () => {
		const frameId = await createProductId();
		const accessoryId = await createProductId(ProductType.ACCESSORY);
		const active = await createSale();
		await createSaleItem({
			saleId: active.id,
			productId: frameId,
			snapshotBrand: 'Ray-Ban',
			unitPrice: 100
		});
		await createSaleItem({
			saleId: active.id,
			productId: accessoryId,
			snapshotBrand: 'SPRAY CLEANER',
			unitPrice: 999
		});

		const cancelled = await createSale({ status: SaleStatus.CANCELLED });
		await createSaleItem({
			saleId: cancelled.id,
			productId: frameId,
			snapshotBrand: 'Ray-Ban',
			unitPrice: 999
		});

		await createSaleItem({
			saleId: active.id,
			itemType: SaleItemType.LENS_PAIR,
			snapshotBrand: 'Essilor',
			unitPrice: 999
		});

		const result = await getReportSalesByBrand(today, today);

		expect(result).toEqual([{ brand: 'Ray-Ban', total: 100, salesCount: 1 }]);
	});

	it('returns nothing outside the date range', async () => {
		const sale = await createSale();
		await createSaleItem({
			saleId: sale.id,
			productId: await createProductId(),
			snapshotBrand: 'Ray-Ban',
			unitPrice: 100
		});

		const result = await getReportSalesByBrand('2000-01-01', '2000-01-02');

		expect(result).toEqual([]);
	});

	it('limits to the top brands by net total', async () => {
		const productId = await createProductId();
		const sale = await createSale();
		await createSaleItem({ saleId: sale.id, productId, snapshotBrand: 'A', unitPrice: 10 });
		await createSaleItem({ saleId: sale.id, productId, snapshotBrand: 'B', unitPrice: 30 });
		await createSaleItem({ saleId: sale.id, productId, snapshotBrand: 'C', unitPrice: 20 });

		const result = await getReportSalesByBrand(today, today, 2);

		expect(result.map((slice) => slice.brand)).toEqual(['B', 'C']);
	});
});
