import { InventoryMovementType } from '$lib/shared/enums';
import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';

export type StockFilter = 'all' | 'out' | 'revert';

export interface StockNetRow {
	/** Display name (product or lens, falls back to "—"). */
	name: string;
	/** Units taken out (SALE_OUT abs sum). */
	out: number;
	/** Units returned (*REVERT sum). */
	revert: number;
	/** out − revert (outstanding units still held by the sale). */
	net: number;
}

export type StockGroupKind = 'creation' | 'edit' | 'cancel';

export interface StockGroup {
	/** referenceType|referenceId|createdById|minute(createdAt). */
	key: string;
	kind: StockGroupKind;
	title: string;
	createdAt: string;
	createdByName: string | null;
	entries: MovementWithDetails[];
}

/** Inputs grouped by operation: reference + actor + minute of createdAt. */
export function groupStockMovements(movements: MovementWithDetails[]): StockGroup[] {
	const byKey = new Map<string, MovementWithDetails[]>();
	for (const movement of movements) {
		const key = `${movement.referenceType}|${movement.referenceId}|${movement.createdById}|${movement.createdAt.slice(0, 16)}`;
		const bucket = byKey.get(key);
		if (bucket) bucket.push(movement);
		else byKey.set(key, [movement]);
	}

	const groups: StockGroup[] = [];
	for (const [key, entries] of byKey) {
		const ordered = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
		const types = new Set(ordered.map((e) => e.movementType));
		const kind: StockGroupKind = types.has(InventoryMovementType.EDIT_REVERT)
			? 'edit'
			: types.has(InventoryMovementType.CANCEL_REVERT)
				? 'cancel'
				: 'creation';
		const first = ordered[0];
		groups.push({
			key,
			kind,
			title: groupTitle(kind, first.createdAt, first.createdByName),
			createdAt: first.createdAt,
			createdByName: first.createdByName,
			entries: ordered
		});
	}

	// Most recent operation first.
	groups.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	return groups;
}

function groupTitle(kind: StockGroupKind, createdAt: string, createdByName: string | null): string {
	if (kind === 'creation') return 'Creación de la venta';
	if (kind === 'cancel') return 'Cancelación';
	const date = createdAt.slice(0, 16).replace('T', ' · ');
	return createdByName ? `Edición · ${date} · ${createdByName}` : `Edición · ${date}`;
}

/** Net effect per product: salidas vs reversiones (EDIT_REVERT + CANCEL_REVERT). */
export function computeStockNet(movements: MovementWithDetails[]): StockNetRow[] {
	const byName = new Map<string, { out: number; revert: number }>();
	for (const movement of movements) {
		const name = movement.itemName ?? '—';
		const row = byName.get(name) ?? { out: 0, revert: 0 };
		if (movement.quantityDelta < 0) row.out += Math.abs(movement.quantityDelta);
		else row.revert += movement.quantityDelta;
		byName.set(name, row);
	}

	return [...byName.entries()]
		.map(([name, { out, revert }]) => ({ name, out, revert, net: out - revert }))
		.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function isStockOut(movementType: string): boolean {
	return (
		movementType === InventoryMovementType.SALE_OUT ||
		movementType === InventoryMovementType.ADJUSTMENT_OUT
	);
}

/** Movements visible under the active filter pill. */
export function filterStockEntries(
	entries: MovementWithDetails[],
	filter: StockFilter
): MovementWithDetails[] {
	if (filter === 'out') return entries.filter((e) => isStockOut(e.movementType));
	if (filter === 'revert') return entries.filter((e) => !isStockOut(e.movementType));
	return entries;
}
