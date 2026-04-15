import type { BadgeVariant } from '$lib/shared/badge-variants';

export interface InventoryLotSummary {
	quantityAvailable: number;
	unitPurchasePrice: number;
}

export function getInventoryValuation(lots: InventoryLotSummary[]): number {
	return lots.reduce((sum, lot) => sum + lot.quantityAvailable * lot.unitPurchasePrice, 0);
}

export function getStockHealth(
	stock: number,
	minStock: number | null | undefined
): { label: string; variant: BadgeVariant } {
	if (stock <= 0) {
		return { label: 'Agotado', variant: 'error' };
	}

	if (minStock == null) {
		return { label: 'Sin minimo', variant: 'neutral' };
	}

	if (stock <= minStock) {
		return { label: 'Stock bajo', variant: 'warning' };
	}

	return { label: 'Saludable', variant: 'success' };
}

export function formatQuantityDelta(quantityDelta: number): string {
	return `${quantityDelta > 0 ? '+' : ''}${quantityDelta}`;
}
