export function isAdjustmentStatusUpdating(
	lineId: number,
	updatingIds: number[]
): boolean {
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

export function getAdjustmentPath(line: {
	productId?: string | null;
	lensCatalogItemId?: string | null;
}): { type: 'product' | 'lens'; id: string } | null {
	if (line.productId) return { type: 'product', id: line.productId };
	if (line.lensCatalogItemId) return { type: 'lens', id: line.lensCatalogItemId };
	return null;
}

export function formatDifference(difference: number | null): string {
	if (difference == null) return '—';
	if (difference === 0) return '0';
	const sign = difference > 0 ? '+' : '';
	return `${sign}${difference}`;
}

export function differenceBadgeClass(difference: number | null): string {
	if (difference == null) return 'bg-slate-100 text-slate-500';
	if (difference > 0) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
	if (difference < 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
	return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
}
