/**
 * Detail (sale/quote) bridge: persisted lines → grouping views, and the
 * per-person display order of the items table.
 */
import { orderItemsByGroups, type ItemGroup } from '$lib/shared/saleItemGroups';
import type { GroupItemView } from './groupsState';

interface PersistedLine {
	id: string;
	itemType: string;
	quantity: number;
	snapshotName: string | null;
	product?: { name?: string | null; type: string } | null;
	freeDetails?: { description: string } | null;
	lensCatalogItem?: { name: string } | null;
}

export function persistedGroupItems<T extends PersistedLine>(
	lines: readonly T[],
	parentOf: (line: T) => string | null | undefined
): GroupItemView[] {
	return lines.map((line) => ({
		id: line.id,
		itemType: line.itemType,
		quantity: line.quantity,
		parentId: parentOf(line) ?? null,
		productType: line.product?.type ?? null,
		name:
			line.itemType === 'FREE_ITEM'
				? (line.freeDetails?.description ?? 'Ítem libre')
				: (line.snapshotName ?? line.product?.name ?? line.lensCatalogItem?.name ?? 'Artículo')
	}));
}

/** Reorders display rows (one per main line) by person; identity without groups. */
export function orderByPerson<R>(
	rows: readonly R[],
	idOf: (row: R) => string,
	views: readonly GroupItemView[],
	groups: readonly ItemGroup[]
): R[] {
	if (groups.length === 0) return [...rows];
	const byId = new Map(rows.map((row) => [idOf(row), row]));
	const ordered = orderItemsByGroups(views, groups)
		.map((v) => byId.get(v.id))
		.filter((row): row is R => row !== undefined);
	// Rows whose id is unknown to the views (never expected) keep their place at the end.
	const seen = new Set(ordered.map(idOf));
	return [...ordered, ...rows.filter((row) => !seen.has(idOf(row)))];
}
