/**
 * Bridge between wizard rows (`SaleItemRow`) and the per-person grouping model.
 * Row ids are sent as the item `id` in the payload, so groups use them as-is.
 */
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { orderItemsByGroups, type ItemGroup } from '$lib/shared/saleItemGroups';
import type { SaleItemRow } from '../newSaleTypes';
import type { GroupItemView } from './groupsState';

const KIND_TO_TYPE: Record<SaleItemRow['kind'], string> = {
	product: SaleItemType.PRODUCT,
	lens: SaleItemType.LENS_PAIR,
	free: SaleItemType.FREE_ITEM,
	treatment: SaleItemType.TREATMENT
};

export function wizardGroupItems(
	rows: readonly SaleItemRow[],
	products: readonly ProductWithRelations[],
	lenses: readonly LensCatalogItemWithRelations[]
): GroupItemView[] {
	return rows.map((row) => {
		const product =
			row.kind === 'product' ? products.find((p) => p.id === row.productId) : undefined;
		let name: string;
		if (row.kind === 'lens') {
			name = lenses.find((l) => l.id === row.lensPair.catalogItemId)?.name ?? 'Cristales';
		} else if (row.kind === 'free') {
			name = row.freeItem?.description || 'Ítem libre';
		} else if (row.kind === 'treatment') {
			name = row.treatmentName;
		} else {
			name = product?.name ?? 'Producto';
		}
		return {
			id: row.id,
			itemType: KIND_TO_TYPE[row.kind],
			quantity: row.kind === 'lens' ? 1 : row.quantity,
			parentId: row.kind === 'treatment' ? row.parentLensItemId : null,
			productType: product?.type ?? null,
			name
		};
	});
}

/** Reorders the wizard rows by person (called when a popover/drawer closes). */
export function orderWizardRows(
	rows: readonly SaleItemRow[],
	views: readonly GroupItemView[],
	groups: readonly ItemGroup[]
): SaleItemRow[] {
	const byId = new Map(rows.map((r) => [r.id, r]));
	const ordered = orderItemsByGroups(views, groups).map((v) => byId.get(v.id)!);
	const unchanged = ordered.every((row, i) => row === rows[i]);
	return unchanged ? [...rows] : ordered;
}
