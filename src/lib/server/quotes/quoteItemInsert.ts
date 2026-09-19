import { quoteItems, quoteItemFreeDetails } from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { buildQuoteItemValues } from '$lib/remote/quotes/helpers';
import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
import type { QuoteItemInput } from '$lib/schemas/quotes';

/** Insert quote items (+ FREE_ITEM details). Caller owns the transaction. */
export async function insertQuoteItems(
	executor: DbOrTx,
	quoteId: string,
	items: QuoteItemInput[],
	now: string
) {
	for (const item of items) {
		const quoteItemId = item.id ?? crypto.randomUUID();
		await executor
			.insert(quoteItems)
			.values(buildQuoteItemValues({ ...item, id: quoteItemId }, quoteId, now));

		if (item.itemType === SaleItemType.FREE_ITEM) {
			await executor.insert(quoteItemFreeDetails).values({
				id: crypto.randomUUID(),
				quoteItemId,
				category: item.freeItemCategory!,
				description: item.freeItemDescription!,
				enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
				unitCost: item.freeItemUnitCost ?? null,
				supplierId: item.freeItemSupplierId ?? null,
				opticalNotes: item.freeItemOpticalNotes ?? null,
				createdAt: now,
				updatedAt: now
			});
		}
	}
}
