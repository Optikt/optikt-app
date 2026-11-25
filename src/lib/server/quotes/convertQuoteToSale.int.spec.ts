import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { convertQuoteToSaleCore } from './convertQuoteToSale';
import { db } from '$lib/server/db';
import {
	customers,
	prescriptions,
	quoteItems,
	quotes,
	sales,
	saleItems
} from '$lib/server/db/schema';
import { buildQuoteItemValues } from './quoteHelpers';
import { replaceQuoteItemGroups } from '$lib/server/db/queries/quotes/itemGroups';
import { findSaleItemGroups } from '$lib/server/db/queries/sales/itemGroups';
import { bumpSaleOrderSequence } from '$lib/server/db/queries/sales/writes';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createInventoryLot,
	createMaterial,
	createProduct,
	createQuote,
	createSale,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { nowISO } from '$lib/dates';
import type { ActionContext } from '$lib/server/actionContext';
import type { QuoteItemInput } from '$lib/schemas/quotes';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null };
}

function productItem(productId: string, unitPrice = 20): QuoteItemInput {
	return {
		itemType: SaleItemType.PRODUCT,
		productId,
		quantity: 1,
		unitPrice,
		discount: 0,
		discountType: DiscountType.FIXED
	};
}

async function seedStockProduct(stock = 5, unitPrice = 20) {
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock
	});
	if (stock > 0) {
		await createInventoryLot({
			productId: product.id,
			quantityInitial: stock,
			quantityAvailable: stock
		});
	}
	return { product, unitPrice };
}

describe('convertQuoteToSaleCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('returns not found for an unknown quote', async () => {
		const result = await convertQuoteToSaleCore(
			{ id: crypto.randomUUID() },
			ctx(crypto.randomUUID())
		);

		expect(result).toEqual({ success: false, error: 'Presupuesto no encontrado' });
	});

	it('rejects a quote that is not in draft', async () => {
		const quote = await createQuote({ status: QuoteStatus.CONVERTED });

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(quote.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'Solo se pueden convertir presupuestos en borrador'
		});
	});

	it('requires a customer when the quote has none (D5)', async () => {
		// El quote necesita ítems: sin ellos gana el error "no tiene ítems" y no
		// se llega a la validación de cliente que verifica este caso.
		const { product } = await seedStockProduct();
		const quote = await createQuote();
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(quote.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'Selecciona o registra al cliente para convertir'
		});
	});

	it('rejects a quote without items', async () => {
		const customer = await createCustomer();
		const seller = await createUser();
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id));

		expect(result).toEqual({ success: false, error: 'El presupuesto no tiene ítems' });
	});

	it('converts a draft quote into a sale, copying isCashea (D4)', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product } = await seedStockProduct();
		const quote = await createQuote({
			customerId: customer.id,
			sellerId: seller.id,
			isCashea: true
		});
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		const items = await db.select().from(saleItems).where(eq(saleItems.saleId, result.sale.id));
		expect(quoteAfter.status).toBe(QuoteStatus.CONVERTED);
		expect(quoteAfter.conversionSaleId).toBe(result.sale.id);
		expect(result.sale.isCashea).toBe(true);
		expect(items).toHaveLength(1);
	});

	it('numbers the converted sale with the sales sequence, after a manual jump', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product } = await seedStockProduct();
		// Admin skipped ahead to #210 (paper sales pending) → next automatic is #211
		await createSale({ orderNumber: 210 });
		await bumpSaleOrderSequence(210);
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');
		expect(result.sale.orderNumber).toBe(211);
	});

	it('assigns an existing customerId to the quote and creates the sale in the same tx (D5)', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product } = await seedStockProduct();
		const quote = await createQuote({ customerId: null, sellerId: seller.id });
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore(
			{ id: quote.id, customerId: customer.id },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		expect(quoteAfter.customerId).toBe(customer.id);
		expect(result.sale.customerId).toBe(customer.id);
	});

	it('creates a newCustomer inline inside the transaction (D5)', async () => {
		const seller = await createUser();
		const { product } = await seedStockProduct();
		const quote = await createQuote({ sellerId: seller.id });
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore(
			{
				id: quote.id,
				newCustomer: {
					firstName: 'Ana',
					lastName: 'Pérez',
					idNumber: 'V-55443322',
					birthDate: '1990-05-01'
				}
			},
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');

		const [created] = await db.select().from(customers).where(eq(customers.idNumber, 'V-55443322'));
		expect(created.firstName).toBe('Ana');

		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		expect(quoteAfter.customerId).toBe(created.id);
		expect(result.sale.customerId).toBe(created.id);
	});

	it('rolls back everything when the inline customer document already exists', async () => {
		const seller = await createUser();
		await createCustomer({ idNumber: 'V-99999999' });
		const { product } = await seedStockProduct();
		const quote = await createQuote({ sellerId: seller.id });
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore(
			{
				id: quote.id,
				newCustomer: { firstName: 'Otro', lastName: 'Cliente', idNumber: 'v-99999999' }
			},
			ctx(seller.id)
		);

		expect(result.success).toBe(false);
		// Nada persistido: sin cliente nuevo, sin venta, quote sigue DRAFT
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		expect(quoteAfter.status).toBe(QuoteStatus.DRAFT);
		expect(quoteAfter.conversionSaleId).toBeNull();
		const salesRows = await db.select().from(sales);
		expect(salesRows).toHaveLength(0);
	});

	it('honors the isCashea override from the modal (D4)', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product } = await seedStockProduct();
		const quote = await createQuote({
			customerId: customer.id,
			sellerId: seller.id,
			isCashea: false
		});
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const result = await convertQuoteToSaleCore({ id: quote.id, isCashea: true }, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');
		expect(result.sale.isCashea).toBe(true);
		// El presupuesto conserva su marca original (el override es de la venta)
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		expect(quoteAfter.isCashea).toBe(false);
	});

	it('creates exactly ONE sale under two concurrent conversions (guard D8)', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product } = await seedStockProduct(10);
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		const [a, b] = await Promise.allSettled([
			convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id)),
			convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id))
		]);

		const salesRows = await db.select().from(sales);
		expect(salesRows).toHaveLength(1);

		const fulfilled = [a, b].filter((r) => r.status === 'fulfilled' && r.value.success);
		const rejectedOrFailed = [a, b].filter(
			(r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
		);
		expect(fulfilled).toHaveLength(1);
		expect(rejectedOrFailed).toHaveLength(1);
		const fulfilledValue = fulfilled[0] as PromiseFulfilledResult<{
			success: true;
			sale: { id: string };
		}>;
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		expect(quoteAfter.conversionSaleId).toBe(fulfilledValue.value.sale.id);
	});

	it('rejects conversion when product stock is insufficient (misma política que venta nueva)', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product } = await seedStockProduct(0);
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });
		await db
			.insert(quoteItems)
			.values(buildQuoteItemValues(productItem(product.id), quote.id, nowISO()));

		// Mismo comportamiento que createSaleCore: el error sube y la tx revierte.
		await expect(convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id))).rejects.toThrow(
			/Stock insuficiente/
		);
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		expect(quoteAfter.status).toBe(QuoteStatus.DRAFT);
	});

	it('derives the prescription WITH altura mapped (fix 0053)', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const { product: lensless } = await seedStockProduct(0); // placeholder supplier/material
		void lensless;
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });
		await db.insert(quoteItems).values(
			buildQuoteItemValues(
				{
					itemType: SaleItemType.LENS_PAIR,
					quantity: 1,
					unitPrice: 90,
					discount: 0,
					discountType: DiscountType.FIXED,
					odSphere: -1.25,
					odCylinder: -0.5,
					odAxis: 15,
					odAltura: 22,
					osSphere: -1.5,
					osCylinder: -0.5,
					osAxis: 15,
					osAltura: 21
				},
				quote.id,
				nowISO()
			)
		);

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');

		const [rx] = await db
			.select()
			.from(prescriptions)
			.where(eq(prescriptions.customerId, customer.id));
		expect(rx.odSphere).toBe(-1.25);
		expect(rx.odAltura).toBe(22);
		expect(rx.osAltura).toBe(21);
		expect(rx.isCurrent).toBe(true);

		const [lensSaleItem] = await db
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, result.sale.id), eq(saleItems.itemType, 'LENS_PAIR')));
		expect(lensSaleItem.prescriptionId).toBe(rx.id);
	});

	it('copies quote_item_groups to sale_item_groups and honors primaryQuoteItemId selection or null', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });
		const qLensA = crypto.randomUUID();
		const qLensB = crypto.randomUUID();
		await db.insert(quoteItems).values([
			buildQuoteItemValues(
				{
					id: qLensA,
					itemType: SaleItemType.LENS_PAIR,
					quantity: 1,
					unitPrice: 80,
					discount: 0,
					discountType: DiscountType.FIXED,
					snapshotName: 'Cristal Sofía',
					odSphere: -1,
					osSphere: -1
				},
				quote.id,
				nowISO()
			),
			buildQuoteItemValues(
				{
					id: qLensB,
					itemType: SaleItemType.LENS_PAIR,
					quantity: 1,
					unitPrice: 90,
					discount: 0,
					discountType: DiscountType.FIXED,
					snapshotName: 'Cristal Andrés',
					odSphere: -3,
					osSphere: -3
				},
				quote.id,
				nowISO()
			)
		]);
		await replaceQuoteItemGroups(
			quote.id,
			[
				{ label: 'Sofía', members: [{ itemId: qLensA, quantity: 1 }] },
				{ label: 'Andrés', members: [{ itemId: qLensB, quantity: 1 }] }
			],
			db
		);

		const result = await convertQuoteToSaleCore(
			{ id: quote.id, primaryQuoteItemId: qLensB },
			ctx(seller.id)
		);
		if (!result.success) throw new Error(result.error);

		const saleGroups = await findSaleItemGroups(result.sale.id);
		expect(saleGroups.map((g) => g.label)).toEqual(['Sofía', 'Andrés']);
		const saleLines = await db.select().from(saleItems).where(eq(saleItems.saleId, result.sale.id));
		const lineB = saleLines.find((l) => l.snapshotName === 'Cristal Andrés')!;
		expect(result.sale.primaryLensItemId).toBe(lineB.id);

		const rxRows = await db
			.select()
			.from(prescriptions)
			.where(eq(prescriptions.customerId, customer.id));
		expect(rxRows).toHaveLength(1);
		expect(rxRows[0].odSphere).toBe(-3);

		// Separate quote converted with primaryQuoteItemId: null ("Ninguna") creates no Rx
		const otherCustomer = await createCustomer();
		const quoteNone = await createQuote({ customerId: otherCustomer.id, sellerId: seller.id });
		await db.insert(quoteItems).values(
			buildQuoteItemValues(
				{
					itemType: SaleItemType.LENS_PAIR,
					quantity: 1,
					unitPrice: 70,
					discount: 0,
					discountType: DiscountType.FIXED,
					odSphere: -2,
					osSphere: -2
				},
				quoteNone.id,
				nowISO()
			)
		);
		const resNone = await convertQuoteToSaleCore(
			{ id: quoteNone.id, primaryQuoteItemId: null },
			ctx(seller.id)
		);
		if (!resNone.success) throw new Error(resNone.error);
		expect(resNone.sale.primaryLensItemId).toBeNull();
		const noneRx = await db
			.select()
			.from(prescriptions)
			.where(eq(prescriptions.customerId, otherCustomer.id));
		expect(noneRx).toHaveLength(0);
	});
});
