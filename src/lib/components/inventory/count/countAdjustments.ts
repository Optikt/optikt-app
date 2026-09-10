import type { InventoryCountLineRow } from '$lib/server/db/queries/inventoryCount';

export type CountAdjustmentPath = `/products/${string}/adjustments` | `/lenses/${string}/adjustments`;

export function isAdjustmentStatusUpdating(lineId: number, updatingIds: number[]): boolean {
	return updatingIds.includes(lineId);
}

export function toggleUpdatingId(
	current: number[],
	lineId: number,
	isAdding: boolean
): number[] {
	if (isAdding) {
		return [...current, lineId];
	}
	return current.filter((id) => id !== lineId);
}

export function hasDifference(line: InventoryCountLineRow): boolean {
	return line.countedStock !== null && (line.difference ?? 0) !== 0;
}

export function isMatchedLine(line: InventoryCountLineRow): boolean {
	return line.countedStock !== null && (line.difference ?? 0) === 0;
}

export function getAdjustmentPath(line: InventoryCountLineRow): CountAdjustmentPath | null {
	if (!hasDifference(line)) {
		return null;
	}

	if (line.itemType === 'PRODUCT' && line.productId) {
		return `/products/${line.productId}/adjustments`;
	}

	if (line.itemType === 'LENS' && line.lensCatalogItemId) {
		return `/lenses/${line.lensCatalogItemId}/adjustments`;
	}

	return null;
}

export function formatDifference(difference: number | null): string {
	if (difference === null || difference === 0) return '—';
	return difference > 0 ? `+${difference}` : `${difference}`;
}

export function differenceBadgeClass(difference: number | null): string {
	if (difference === null) return 'bg-surface-container text-on-surface-variant';
	if (difference === 0) return 'bg-surface-container text-on-surface-variant';
	return difference > 0
		? 'bg-success-container/70 text-success'
		: 'bg-error-container/80 text-error';
}
