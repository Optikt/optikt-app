import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createNewQuoteCore } from './createNewQuote';
import { updateExistingQuoteCore } from './updateExistingQuote';
import { db } from '$lib/server/db';
import { changeHistory, quoteItemFreeDetails, quoteItems } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createMaterial,
	createProduct,
	createQuote,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType, FreeItemCategory } from '$lib/shared/enums/lensTypes';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { businessDateISO } from '$lib/shared/quotes/quoteValidity';
import type { ActionContext } from '$lib/server/actionContext';
import type { CreateQuoteInput, QuoteItemInput, UpdateQuoteInput } from '$lib/schemas/quotes';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null };
}

function item(productId: string, unitPrice = 20): QuoteItemInput {
	return {
		itemType: SaleItemType.PRODUCT,
		productId,
		quantity: 1,
		unitPrice,
		discount: 0,
		discountType: DiscountType.FIXED
	};
}

async function seedProduct() {
	const supplier = await createSupplier();
	const material = await createMaterial();
	return createProduct({ supplierId: supplier.id, materialId: material.id, stock: 10 });
}

describe('updateExistingQuoteCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('replaces items and updates the header', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const createInput: CreateQuoteInput = {
			quoteDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			isCashea: false,
			items: [item(product.id)]
		};
		const created = await createNewQuoteCore(createInput, ctx(seller.id));
		if (!created.success) throw new Error('quote was not created');

		const update: UpdateQuoteInput = {
			id: created.quote.id,
			notes: 'editado',
			items: [item(product.id, 30)]
		};

		const result = await updateExistingQuoteCore(update, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not updated');
		expect(result.quote.notes).toBe('editado');
		expect(result.quote.total).toBeGreaterThan(0);
	});

	it('rejects a quote that is not in draft', async () => {
		const quote = await createQuote({ status: QuoteStatus.CONVERTED });
		const update: UpdateQuoteInput = { id: quote.id, items: [item(crypto.randomUUID())] };

		const result = await updateExistingQuoteCore(update, ctx(quote.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'Solo se pueden editar presupuestos en borrador'
		});
	});

	it('returns not found for an unknown quote', async () => {
		const update: UpdateQuoteInput = {
			id: crypto.randomUUID(),
			items: [item(crypto.randomUUID())]
		};

		const result = await updateExistingQuoteCore(update, ctx(crypto.randomUUID()));

		expect(result).toEqual({ success: false, error: 'Presupuesto no encontrado' });
	});

	it('replaces items with a FREE_ITEM and stores its free details', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const created = await createNewQuoteCore(
			{
				quoteDate: '2026-09-15',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				isCashea: false,
				items: [item(product.id)]
			},
			ctx(seller.id)
		);
		if (!created.success) throw new Error('quote was not created');
		const update: UpdateQuoteInput = {
			id: created.quote.id,
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

		const result = await updateExistingQuoteCore(update, ctx(seller.id));

		expect(result.success).toBe(true);
		const storedItems = await db
			.select()
			.from(quoteItems)
			.where(eq(quoteItems.quoteId, created.quote.id));
		const details = await db
			.select()
			.from(quoteItemFreeDetails)
			.where(eq(quoteItemFreeDetails.quoteItemId, storedItems[0].id));
		expect(storedItems).toHaveLength(1);
		expect(details).toHaveLength(1);
	});

	it('updates isCashea and clears validUntil (D3/D4)', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const created = await createNewQuoteCore(
			{
				quoteDate: '2026-09-15',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				isCashea: false,
				validUntil: '2026-09-30',
				items: [item(product.id)]
			},
			ctx(seller.id)
		);
		if (!created.success) throw new Error('quote was not created');
		expect(created.quote.validUntil).toBeTruthy();

		const update: UpdateQuoteInput = {
			id: created.quote.id,
			isCashea: true,
			validUntil: null,
			items: [item(product.id)]
		};

		const result = await updateExistingQuoteCore(update, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not updated');
		expect(result.quote.isCashea).toBe(true);
		expect(result.quote.validUntil).toBeNull();
	});
	it('persiste quoteDate editado (día de negocio, no createdAt)', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const created = await createNewQuoteCore(
			{
				quoteDate: '2026-09-15',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				isCashea: false,
				items: [item(product.id)]
			},
			ctx(seller.id)
		);
		if (!created.success) throw new Error('quote was not created');

		const result = await updateExistingQuoteCore(
			{ id: created.quote.id, quoteDate: '2026-10-20', items: [item(product.id, 25)] },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not updated');
		expect(businessDateISO(result.quote.quoteDate)).toBe('2026-10-20');
	});

	it('anexa el diff estructurado (itemsDiff) al evento de edición, como ventas', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const created = await createNewQuoteCore(
			{
				quoteDate: '2026-09-15',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				isCashea: false,
				items: [item(product.id)]
			},
			ctx(seller.id)
		);
		if (!created.success) throw new Error('quote was not created');
		const [stored] = await db
			.select()
			.from(quoteItems)
			.where(eq(quoteItems.quoteId, created.quote.id));

		// Mismo ítem (id conservado) con otro precio + Cashea activado.
		const result = await updateExistingQuoteCore(
			{
				id: created.quote.id,
				isCashea: true,
				items: [{ ...item(product.id, 35), id: stored.id }]
			},
			ctx(seller.id)
		);
		expect(result.success).toBe(true);

		const events = await db
			.select()
			.from(changeHistory)
			.where(
				and(
					eq(changeHistory.entityType, 'quote'),
					eq(changeHistory.entityId, created.quote.id),
					eq(changeHistory.action, 'update')
				)
			);
		expect(events).toHaveLength(1);
		const changes = events[0].changes as Record<string, { new?: unknown }>;
		const diff = changes.itemsDiff?.new as {
			items: { t: string }[];
			header: { key: string; label: string }[];
			totals: { label: string }[];
		};
		expect(diff.items.map((c) => c.t)).toEqual(['mod']);
		expect(diff.header.find((h) => h.key === 'isCashea')).toBeTruthy();
		expect(diff.totals.map((t) => t.label)).toContain('Total');
	});

	it('sin cambios reales no registra evento de edición', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const created = await createNewQuoteCore(
			{
				quoteDate: '2026-09-15',
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotTaxRate: 16,
				isCashea: false,
				items: [item(product.id)]
			},
			ctx(seller.id)
		);
		if (!created.success) throw new Error('quote was not created');
		const [stored] = await db
			.select()
			.from(quoteItems)
			.where(eq(quoteItems.quoteId, created.quote.id));

		await updateExistingQuoteCore(
			{ id: created.quote.id, items: [{ ...item(product.id), id: stored.id }] },
			ctx(seller.id)
		);

		const events = await db
			.select()
			.from(changeHistory)
			.where(
				and(
					eq(changeHistory.entityType, 'quote'),
					eq(changeHistory.entityId, created.quote.id),
					eq(changeHistory.action, 'update')
				)
			);
		expect(events).toHaveLength(0);
	});
});
