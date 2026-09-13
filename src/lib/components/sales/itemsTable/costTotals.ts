import { FreeItemEnrichmentStatus, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { DisplayGroup } from './itemDisplay';

export function computeInternalCostTotal(groups: DisplayGroup[]): number {
	let total = 0;
	for (const group of groups) {
		if (group.item.itemType === SaleItemType.FREE_ITEM) {
			if (group.item.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.ENRICHED) {
				total += (group.item.freeDetails.unitCost ?? 0) * group.quantity;
			}
		} else if (group.item.snapshotCostTotal != null) {
			total += group.item.snapshotCostTotal;
		} else if (group.item.itemType === SaleItemType.LENS_PAIR) {
			const base = group.item.snapshotBaseCost ?? 0;
			const mounting = group.item.snapshotMountingPrice ?? 0;
			const shipping = group.item.shippingCostPending
				? 0
				: (group.item.snapshotShippingPrice ?? 0);
			total += base + mounting + shipping;
		} else if (group.item.snapshotCostUnit != null) {
			total += group.item.snapshotCostUnit * group.quantity;
		}
	}
	return total;
}

export function checkHasAnyCost(groups: DisplayGroup[]): boolean {
	return groups.some(
		(g) =>
			g.item.snapshotCostTotal != null ||
			g.item.snapshotBaseCost != null ||
			g.item.snapshotMountingPrice != null ||
			g.item.snapshotShippingPrice != null ||
			g.item.snapshotCostUnit != null ||
			(g.item.itemType === SaleItemType.FREE_ITEM &&
				g.item.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.ENRICHED)
	);
}
