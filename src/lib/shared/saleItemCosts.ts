interface LensSnapshotCostInput {
	snapshotBaseCost?: number | null;
	snapshotMountingPrice?: number | null;
	snapshotShippingPrice?: number | null;
	shippingCostPending?: boolean | null;
}

export function computeLensSnapshotCostTotal({
	snapshotBaseCost,
	snapshotMountingPrice,
	snapshotShippingPrice,
	shippingCostPending
}: LensSnapshotCostInput): number {
	const baseCost = snapshotBaseCost ?? 0;
	const mountingPrice = snapshotMountingPrice ?? 0;
	const shippingPrice = shippingCostPending ? 0 : (snapshotShippingPrice ?? 0);

	return baseCost + mountingPrice + shippingPrice;
}

export function computeSnapshotCostUnit(totalCost: number, quantity: number): number | null {
	if (!Number.isFinite(totalCost) || !Number.isFinite(quantity) || quantity <= 0) {
		return null;
	}

	return totalCost / quantity;
}

import { SaleItemType } from '$lib/shared/enums/lensTypes';

/**
 * Snapshot de costos por ítem: total y unitario, solo para LENS_PAIR.
 * Fuente única (antes duplicada en remote/quotes/helpers y remote/sales/helpers).
 */
export function resolveLensSnapshotCosts(item: {
	itemType: string;
	quantity: number;
	snapshotBaseCost?: number | null;
	snapshotMountingPrice?: number | null;
	snapshotShippingPrice?: number | null;
	shippingCostPending?: boolean | null;
}): { snapshotCostTotal: number | null; snapshotCostUnit: number | null } {
	if (item.itemType !== SaleItemType.LENS_PAIR) {
		return { snapshotCostTotal: null, snapshotCostUnit: null };
	}

	const snapshotCostTotal = computeLensSnapshotCostTotal({
		snapshotBaseCost: item.snapshotBaseCost,
		snapshotMountingPrice: item.snapshotMountingPrice,
		snapshotShippingPrice: item.snapshotShippingPrice,
		shippingCostPending: item.shippingCostPending ?? false
	});

	return {
		snapshotCostTotal,
		snapshotCostUnit: computeSnapshotCostUnit(snapshotCostTotal, item.quantity)
	};
}
