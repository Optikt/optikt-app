import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { enrichFreeItemCore } from './enrichFreeItem';
import { db } from '$lib/server/db';
import { saleItemFreeDetails } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import { createSaleItem, createUser } from '$lib/testing/integration/factories';
import {
	FreeItemCategory,
	FreeItemEnrichmentStatus,
	SaleItemType
} from '$lib/shared/enums/lensTypes';
import { UserRole } from '$lib/shared/enums';
import { nowISO } from '$lib/dates';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

async function seedFreeItem() {
	const admin = await createUser({ role: UserRole.ADMIN });
	const item = await createSaleItem({ itemType: SaleItemType.FREE_ITEM, unitPrice: 10 });
	await db.insert(saleItemFreeDetails).values({
		id: crypto.randomUUID(),
		saleItemId: item.id,
		category: FreeItemCategory.SERVICE,
		description: 'Servicio de prueba',
		enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
		createdAt: nowISO(),
		updatedAt: nowISO()
	});
	return { admin, item };
}

describe('enrichFreeItemCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('enriches a free item and stamps the actor', async () => {
		const { admin, item } = await seedFreeItem();

		const result = await enrichFreeItemCore(
			{ saleItemId: item.id, category: FreeItemCategory.SERVICE, unitCost: 0 },
			ctx(admin.id)
		);

		expect(result.success).toBe(true);
		const [details] = await db
			.select()
			.from(saleItemFreeDetails)
			.where(eq(saleItemFreeDetails.saleItemId, item.id));
		expect(details.enrichmentStatus).toBe(FreeItemEnrichmentStatus.ENRICHED);
		expect(details.enrichedById).toBe(admin.id);
	});

	it('rejects a sale item that is not a free item', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const item = await createSaleItem();

		const result = await enrichFreeItemCore(
			{ saleItemId: item.id, category: FreeItemCategory.SERVICE, unitCost: 0 },
			ctx(admin.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'El artículo no es de tipo ítem libre'
		});
	});

	it('rejects an unknown supplier', async () => {
		const { admin, item } = await seedFreeItem();

		const result = await enrichFreeItemCore(
			{
				saleItemId: item.id,
				category: FreeItemCategory.SERVICE,
				unitCost: 0,
				supplierId: crypto.randomUUID()
			},
			ctx(admin.id)
		);

		expect(result).toEqual({ success: false, error: 'Proveedor no encontrado' });
	});

	it('returns not found for an unknown item', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });

		const result = await enrichFreeItemCore(
			{ saleItemId: crypto.randomUUID(), category: FreeItemCategory.SERVICE, unitCost: 0 },
			ctx(admin.id)
		);

		expect(result).toEqual({ success: false, error: 'Artículo de venta no encontrado' });
	});
});
