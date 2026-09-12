import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { LensCatalogSource, LensInventoryMode } from '$lib/shared/enums';

export const lensCatalogColumns = [
	{ key: 'lens', label: 'Lente' },
	{ key: 'ranges', label: 'Rangos ópticos' },
	{ key: 'price', label: 'Precio venta', align: 'right' as const },
	{ key: 'status', label: 'Estado', align: 'right' as const },
	{ key: 'actions', label: 'Acciones', align: 'right' as const }
];

export function statusVariant(
	item: LensCatalogItemWithRelations
): 'success' | 'warning' | 'error' | 'neutral' {
	if (item.inventoryMode === LensInventoryMode.ON_DEMAND) return 'warning';
	if (item.stock == null) return 'neutral';
	if (item.stock <= 0) return 'error';
	return 'success';
}

export function statusLabel(item: LensCatalogItemWithRelations): string {
	if (item.inventoryMode === LensInventoryMode.ON_DEMAND) return 'Por pedido';
	if (item.stock == null) return 'Sin dato';
	if (item.stock <= 0) return 'Agotado';
	return 'En stock';
}

export function supplierLabel(item: LensCatalogItemWithRelations): string {
	return item.supplier?.name?.trim() || 'Sin proveedor';
}

export function sourceMicroBadgeLabel(item: LensCatalogItemWithRelations): string {
	return item.source === LensCatalogSource.FINISHED ? 'Terminado' : 'Laboratorio';
}

export function sourceMicroBadgeClass(item: LensCatalogItemWithRelations): string {
	return item.source === LensCatalogSource.FINISHED
		? 'bg-brand-blue-light/35 text-brand-blue-dark'
		: 'bg-amber-100 text-amber-800';
}

export function totalCost(item: LensCatalogItemWithRelations): number {
	return item.pairPurchasePrice + item.mountingPrice + item.shippingPrice;
}
