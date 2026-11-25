/**
 * Bridge between the edit drawer's `EditableItem`s (sale or quote) and the
 * per-person grouping model. Existing lines keep their DB id; new lines carry
 * a client id that the server translates.
 */
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import {
	normalizeGroupLabel,
	orderItemsByGroups,
	type ItemGroup
} from '$lib/shared/saleItemGroups';
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

/**
 * Canonical comparison key for "did the grouping change?":
 * preserves `null` vs explicit `"Trabajo N"` labels and sorts members by itemId
 * so re-assigning the same item never causes false positives.
 */
export function groupsSignature(groups: readonly ItemGroup[]): string {
	return JSON.stringify(
		groups.map((g) => ({
			label: normalizeGroupLabel(g.label),
			members: [...g.members]
				.sort((a, b) => a.itemId.localeCompare(b.itemId))
				.map((m) => [m.itemId, m.quantity])
		}))
	);
}

/** Orders edit-drawer main rows by person (without touching rows that lack an id). */
export function orderEditableByGroups(
	mainItems: readonly EditableItem[],
	views: readonly GroupItemView[],
	groups: readonly ItemGroup[]
): EditableItem[] {
	if (groups.every((g) => g.members.length === 0)) return [...mainItems];
	const byId = new Map(mainItems.filter((i) => i.id).map((i) => [i.id as string, i]));
	const orderedIds = orderItemsByGroups(views, groups)
		.map((v) => v.id)
		.filter((id) => byId.has(id));
	const seen = new Set(orderedIds);
	const ordered = orderedIds.map((id) => byId.get(id)!);
	for (const item of mainItems) {
		if (!item.id || !seen.has(item.id)) ordered.push(item);
	}
	return ordered;
}
