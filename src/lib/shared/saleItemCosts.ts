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
