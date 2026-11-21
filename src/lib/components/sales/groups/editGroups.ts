/**
 * Bridge between the edit drawer's `EditableItem`s (sale or quote) and the
 * per-person grouping model. Existing lines keep their DB id; new lines carry
 * a client id that the server translates.
 */
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { summarizeGroups, type ItemGroup } from '$lib/shared/saleItemGroups';
import type { EditableItem } from '../editSaleDraft';
import type { GroupItemView } from './groupsState';

export function editableGroupItems(
	items: readonly EditableItem[],
	productTypes: ReadonlyMap<string, string | null>
): GroupItemView[] {
	return items
		.filter((item): item is EditableItem & { id: string } => !!item.id && !item._removed)
		.map((item) => ({
			id: item.id,
			itemType: item.itemType,
			quantity: item.quantity,
			parentId: item.parentSaleItemId ?? null,
			productType: item.productId ? (productTypes.get(item.productId) ?? null) : null,
			name:
				item.snapshotName ??
				item.freeItemDescription ??
				(item.itemType === SaleItemType.LENS_PAIR ? 'Cristales' : 'Artículo')
		}));
}

/** Stable comparison key for "did the grouping change?". */
export function groupsSignature(groups: readonly ItemGroup[]): string {
	return summarizeGroups(groups, (id) => id);
}
