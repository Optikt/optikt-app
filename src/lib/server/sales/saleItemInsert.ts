import { saleItemFreeDetails, saleItems } from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { consumeFifoForSaleItem } from '$lib/server/db/queries/fifoConsumption';
import { resolveLensSnapshotCosts } from '$lib/remote/quotes/helpers';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { saleItemCommonValues, type SaleItemValueSource } from '$lib/shared/saleItemValues';

type FreeDetailsInsert = typeof saleItemFreeDetails.$inferInsert;

export interface SaleItemInsertParams {
	id: string;
	saleId: string;
	item: SaleItemValueSource;
	parentSaleItemId: string | null;
	prescriptionId: string | null;
	lotId: string | null;
	snapshotCostTotal: number | null;
	snapshotCostUnit: number | null;
	snapshotLotsCount: number | null;
	now: string;
}

export function saleItemInsertValues(params: SaleItemInsertParams) {
	return {
		id: params.id,
		saleId: params.saleId,
		parentSaleItemId: params.parentSaleItemId,
		prescriptionId: params.prescriptionId,
		lotId: params.lotId,
		...saleItemCommonValues(params.item),
		snapshotCostTotal: params.snapshotCostTotal,
		snapshotCostUnit: params.snapshotCostUnit,
		snapshotLotsCount: params.snapshotLotsCount,
		shippingCostPending: params.item.shippingCostPending ?? false,
		createdAt: params.now,
		updatedAt: params.now
	};
}

export interface InsertSaleItemParams {
	id: string;
	saleId: string;
	item: SaleItemValueSource;
	parentSaleItemId: string | null;
	prescriptionId: string | null;
	userId: string;
	now: string;
}

/** FIFO lot consumption + snapshot costs + sale item insert. Caller owns the transaction. */
export async function insertSaleItem(executor: DbOrTx, params: InsertSaleItemParams) {
	let lotId: string | null = null;
	let snapshotCostTotal: number | null = null;
	let snapshotCostUnit: number | null = null;
	let snapshotLotsCount: number | null = null;

	if (params.item.itemType !== SaleItemType.FREE_ITEM) {
		({ lotId, snapshotCostTotal, snapshotCostUnit, snapshotLotsCount } =
			await consumeFifoForSaleItem(executor, params.saleId, params.item, params.userId));
	}

	const lensSnapshotCosts = resolveLensSnapshotCosts(params.item);

	await executor.insert(saleItems).values(
		saleItemInsertValues({
			id: params.id,
			saleId: params.saleId,
			item: params.item,
			parentSaleItemId: params.parentSaleItemId,
			prescriptionId: params.prescriptionId,
			lotId,
			snapshotCostTotal: lensSnapshotCosts.snapshotCostTotal ?? snapshotCostTotal,
			snapshotCostUnit: lensSnapshotCosts.snapshotCostUnit ?? snapshotCostUnit,
			snapshotLotsCount,
			now: params.now
		})
	);
}

export interface SaleItemFreeDetailsInsertParams {
	id: string;
	saleItemId: string;
	category: FreeDetailsInsert['category'];
	description: string;
	enrichmentStatus: FreeDetailsInsert['enrichmentStatus'];
	unitCost?: number | null;
	supplierId?: string | null;
	opticalNotes?: string | null;
	enrichedAt?: string | null;
	enrichedById?: string | null;
	now: string;
}

export function saleItemFreeDetailsInsertValues(params: SaleItemFreeDetailsInsertParams) {
	return {
		id: params.id,
		saleItemId: params.saleItemId,
		category: params.category,
		description: params.description,
		enrichmentStatus: params.enrichmentStatus,
		unitCost: params.unitCost ?? null,
		supplierId: params.supplierId ?? null,
		opticalNotes: params.opticalNotes ?? null,
		enrichedAt: params.enrichedAt ?? null,
		enrichedById: params.enrichedById ?? null,
		createdAt: params.now,
		updatedAt: params.now
	};
}
