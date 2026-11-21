/**
 * Per-person grouping of sale / quote lines ("Agrupar por persona").
 *
 * Pure logic shared by the wizard, edit drawer, detail, print and the server.
 * A group is a person (free-text label) or an unnamed "Trabajo N". Lines are
 * NEVER split: a line with quantity 2 can be allocated 1 + 1 to two groups
 * (`members[].quantity`), and Σ allocations ≤ line quantity. Treatments follow
 * their lens (`parentId`) and are never members.
 */

import { ProductType } from '$lib/shared/enums/productTypes';

export const MAX_ITEM_GROUPS = 20;
export const ITEM_GROUP_LABEL_MAX = 60;

/** Item types that can be allocated to a group (TREATMENT follows its lens). */
export const GROUPABLE_ITEM_TYPES = ['PRODUCT', 'LENS_PAIR', 'FREE_ITEM'] as const;

export interface GroupMember {
	itemId: string;
	quantity: number;
}

export interface ItemGroup {
	label: string | null;
	members: GroupMember[];
}

/** Minimal line shape the helpers need (sale item, quote item or wizard row). */
export interface GroupableItem {
	id: string;
	itemType: string;
	quantity: number;
	/** Parent LENS_PAIR id for TREATMENT lines. */
	parentId?: string | null;
	/** Product type for PRODUCT lines (orders frame before lens before accessory). */
	productType?: string | null;
}

export function isGroupableItemType(itemType: string): boolean {
	return (GROUPABLE_ITEM_TYPES as readonly string[]).includes(itemType);
}

// ============================================================================
// QUANTITIES
// ============================================================================

/** Units of `itemId` allocated across all groups (optionally skipping one group). */
export function assignedQty(
	groups: readonly ItemGroup[],
	itemId: string,
	exceptGroupIndex = -1
): number {
	let total = 0;
	groups.forEach((group, index) => {
		if (index === exceptGroupIndex) return;
		for (const member of group.members) {
			if (member.itemId === itemId) total += member.quantity;
		}
	});
	return total;
}

export function remainingQty(item: GroupableItem, groups: readonly ItemGroup[]): number {
	return Math.max(0, item.quantity - assignedQty(groups, item.id));
}

/**
 * Sets the units of `item` in group `groupIndex`, clamped to what the other
 * groups leave free. `quantity <= 0` removes the member. Returns new groups.
 */
export function setMemberQuantity<G extends ItemGroup>(
	groups: readonly G[],
	groupIndex: number,
	item: GroupableItem,
	quantity: number
): G[] {
	const available = Math.max(0, item.quantity - assignedQty(groups, item.id, groupIndex));
	const next = Math.min(Math.max(0, Math.floor(quantity)), available);

	return groups.map((group, index) => {
		if (index !== groupIndex) return group;
		const others = group.members.filter((m) => m.itemId !== item.id);
		if (next === 0) return { ...group, members: others };
		const existingIndex = group.members.findIndex((m) => m.itemId === item.id);
		if (existingIndex === -1) {
			return { ...group, members: [...group.members, { itemId: item.id, quantity: next }] };
		}
		const members = group.members.map((m) =>
			m.itemId === item.id ? { itemId: item.id, quantity: next } : m
		);
		return { ...group, members };
	});
}

/**
 * Repairs allocations after items change (removed line, lower quantity, type
 * not groupable). Over-allocation is trimmed from the last group backwards so
 * the first person keeps their units. Empty groups are kept (see `dropEmptyGroups`).
 */
export function clampAllocations<G extends ItemGroup>(
	groups: readonly G[],
	items: readonly GroupableItem[]
): G[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	const budget = new Map<string, number>();
	for (const item of items) {
		if (isGroupableItemType(item.itemType)) budget.set(item.id, Math.max(0, item.quantity));
	}

	// Walk groups in order, consuming each item's budget first-come.
	const result = groups.map((group) => {
		const seen = new Set<string>();
		const members: GroupMember[] = [];
		for (const member of group.members) {
			if (seen.has(member.itemId) || !byId.has(member.itemId)) continue;
			const left = budget.get(member.itemId);
			if (left === undefined || left <= 0) continue;
			const quantity = Math.min(Math.max(0, Math.floor(member.quantity)), left);
			if (quantity <= 0) continue;
			budget.set(member.itemId, left - quantity);
			seen.add(member.itemId);
			members.push({ itemId: member.itemId, quantity });
		}
		return { ...group, members };
	});

	return result;
}

export function dropEmptyGroups<G extends ItemGroup>(groups: readonly G[]): G[] {
	return groups.filter((group) => group.members.length > 0);
}

// ============================================================================
// LABELS
// ============================================================================

export function normalizeGroupLabel(label: string | null | undefined): string | null {
	const trimmed = (label ?? '').trim().slice(0, ITEM_GROUP_LABEL_MAX);
	return trimmed === '' ? null : trimmed;
}

/** Display name: the label, or "Trabajo N" (1-based position) when unnamed. */
export function groupDisplayLabel(label: string | null | undefined, index: number): string {
	return normalizeGroupLabel(label) ?? `Trabajo ${index + 1}`;
}

export function hasAnyLabel(groups: readonly ItemGroup[]): boolean {
	return groups.some((group) => normalizeGroupLabel(group.label) !== null);
}

/** Duplicating a quote keeps the pairing but clears the names (like the Rx). */
export function clearLabels<G extends ItemGroup>(groups: readonly G[]): G[] {
	return groups.map((group) => ({ ...group, label: null }));
}

/** Submit shape: trimmed labels, no empty groups, positive integer quantities. */
export function normalizeGroupsForSubmit(
	groups: readonly ItemGroup[]
): { label: string | null; members: GroupMember[] }[] {
	return dropEmptyGroups(
		groups.map((group) => ({
			label: normalizeGroupLabel(group.label),
			members: group.members
				.filter((m) => m.quantity > 0)
				.map((m) => ({ itemId: m.itemId, quantity: Math.floor(m.quantity) }))
		}))
	);
}

// ============================================================================
// CHIP (per-line "PARA" indicator)
// ============================================================================

export interface ChipShare {
	groupIndex: number;
	label: string;
	quantity: number;
}

export interface ChipModel {
	/** none = no unit assigned; single = all assigned units go to one group; multi = several groups. */
	state: 'none' | 'single' | 'multi';
	shares: ChipShare[];
	assigned: number;
	free: number;
	/** Short chip text: "Sin asignar" | "Sofía" | "2 personas" (+ " · 1 libre"). */
	text: string;
	/** Tooltip lines: "1 · Sofía", "1 · sin asignar". */
	detail: string[];
}

export function chipModel(item: GroupableItem, groups: readonly ItemGroup[]): ChipModel {
	const shares: ChipShare[] = [];
	groups.forEach((group, groupIndex) => {
		const quantity = group.members
			.filter((m) => m.itemId === item.id)
			.reduce((sum, m) => sum + m.quantity, 0);
		if (quantity > 0) {
			shares.push({ groupIndex, label: groupDisplayLabel(group.label, groupIndex), quantity });
		}
	});

	const assigned = shares.reduce((sum, s) => sum + s.quantity, 0);
	const free = Math.max(0, item.quantity - assigned);
	const state = shares.length === 0 ? 'none' : shares.length === 1 ? 'single' : 'multi';

	let text: string;
	if (state === 'none') text = 'Sin asignar';
	else if (state === 'single') text = shares[0].label;
	else text = `${shares.length} personas`;
	if (state !== 'none' && free > 0) text += ` · ${free} libre`;

	const detail = shares.map((s) => `${s.quantity} · ${s.label}`);
	if (state !== 'none' && free > 0) detail.push(`${free} · sin asignar`);

	return { state, shares, assigned, free, text, detail };
}

// ============================================================================
// PRIMARY PRESCRIPTION (sales only)
// ============================================================================

/**
 * Default "fórmula principal": exactly one lens line and no named group keeps
 * today's daily flow (that lens becomes the customer's current Rx). Anything
 * else (several lenses, or names typed) → no default, nothing is overwritten.
 */
export function defaultPrimaryLens(
	items: readonly GroupableItem[],
	groups: readonly ItemGroup[]
): string | null {
	const lenses = items.filter((item) => item.itemType === 'LENS_PAIR');
	if (lenses.length !== 1) return null;
	if (hasAnyLabel(groups)) return null;
	return lenses[0].id;
}

// ============================================================================
// VALIDATION (Zod refine + server, same rules)
// ============================================================================

/**
 * Returns human-readable violations (empty = valid):
 * unknown item, non-groupable type, Σ > quantity, duplicated member, primary not a lens.
 */
export function validateItemGroups(
	groups: readonly ItemGroup[],
	items: readonly GroupableItem[],
	primaryLensItemId?: string | null
): string[] {
	const errors: string[] = [];
	const byId = new Map(items.map((item) => [item.id, item]));

	if (groups.length > MAX_ITEM_GROUPS) errors.push(`Máximo ${MAX_ITEM_GROUPS} personas`);

	groups.forEach((group, groupIndex) => {
		const name = groupDisplayLabel(group.label, groupIndex);
		const seen = new Set<string>();
		for (const member of group.members) {
			const item = byId.get(member.itemId);
			if (!item) {
				errors.push(`${name}: artículo inexistente`);
				continue;
			}
			if (!isGroupableItemType(item.itemType)) {
				errors.push(`${name}: los tratamientos siguen a su cristal y no se asignan`);
			}
			if (seen.has(member.itemId)) errors.push(`${name}: artículo repetido`);
			seen.add(member.itemId);
			if (!Number.isInteger(member.quantity) || member.quantity < 1) {
				errors.push(`${name}: cantidad inválida`);
			}
		}
	});

	for (const item of items) {
		if (assignedQty(groups, item.id) > item.quantity) {
			errors.push('Se asignaron más unidades de las que tiene la línea');
			break;
		}
	}

	if (primaryLensItemId) {
		const primary = byId.get(primaryLensItemId);
		if (!primary || primary.itemType !== 'LENS_PAIR') {
			errors.push('La fórmula principal debe ser un cristal de la venta');
		}
	}

	return errors;
}

// ============================================================================
// DISPLAY ORDER (detail, edit drawer, wizard, ticket, PDF)
// ============================================================================

const ACCESSORY_RANK = 2;

function displayRank(item: GroupableItem): number {
	if (item.itemType === 'LENS_PAIR') return 1;
	if (item.itemType === 'PRODUCT' && item.productType) {
		return item.productType === ProductType.FRAME ||
			item.productType === ProductType.SUNGLASSES ||
			item.productType === ProductType.CONTACT_LENS
			? 0
			: ACCESSORY_RANK;
	}
	return 0;
}

/**
 * Stable display order by person: for each group in order → frame/product,
 * lens (+ its treatments right after), accessories; then unassigned lines in
 * original order. A shared line appears once, in its first group
 * ("montura ×2, cristal, cristal"). No groups → identity (today's order).
 * Never persisted: rows are read by createdAt and re-ordered at render time.
 */
export function orderItemsByGroups<T extends GroupableItem>(
	items: readonly T[],
	groups: readonly ItemGroup[]
): T[] {
	if (groups.every((g) => g.members.length === 0)) return [...items];

	const originalIndex = new Map(items.map((item, index) => [item.id, index]));
	const byId = new Map(items.map((item) => [item.id, item]));
	const childrenOf = new Map<string, T[]>();
	for (const item of items) {
		if (item.parentId && byId.has(item.parentId)) {
			const list = childrenOf.get(item.parentId) ?? [];
			list.push(item);
			childrenOf.set(item.parentId, list);
		}
	}

	const placed = new Set<string>();
	const out: T[] = [];
	const place = (item: T) => {
		if (placed.has(item.id)) return;
		placed.add(item.id);
		out.push(item);
		for (const child of childrenOf.get(item.id) ?? []) {
			if (!placed.has(child.id)) {
				placed.add(child.id);
				out.push(child);
			}
		}
	};

	for (const group of groups) {
		const groupItems = group.members
			.map((m) => byId.get(m.itemId))
			.filter((item): item is T => !!item && !(item.parentId && byId.has(item.parentId)))
			.sort(
				(a, b) =>
					displayRank(a) - displayRank(b) ||
					(originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0)
			);
		for (const item of groupItems) place(item);
	}

	for (const item of items) {
		if (item.parentId && byId.has(item.parentId)) continue; // placed with its parent
		place(item);
	}
	// Orphan treatments (parent missing) keep their place at the end.
	for (const item of items) place(item);

	return out;
}

// ============================================================================
// WIZARD: auto-included accessories follow their frame
// ============================================================================

/**
 * After the frame's allocation changes, mirror it onto its auto-included
 * accessories (same groups, same units, clamped to each accessory's quantity).
 * The frame→accessory link only lives in the wizard; once saved, the group keeps it.
 */
export function followIncludedAccessories<G extends ItemGroup>(
	groups: readonly G[],
	items: readonly GroupableItem[],
	frameId: string,
	accessoryIds: readonly string[]
): G[] {
	if (accessoryIds.length === 0) return [...groups];
	const accessorySet = new Set(accessoryIds);
	const byId = new Map(items.map((item) => [item.id, item]));

	const stripped = groups.map((group) => ({
		...group,
		members: group.members.filter((m) => !accessorySet.has(m.itemId))
	}));

	const used = new Map<string, number>();
	return stripped.map((group) => {
		const frameMember = group.members.find((m) => m.itemId === frameId);
		if (!frameMember) return group;
		const added: GroupMember[] = [];
		for (const accessoryId of accessoryIds) {
			const accessory = byId.get(accessoryId);
			if (!accessory) continue;
			const left = accessory.quantity - (used.get(accessoryId) ?? 0);
			const quantity = Math.min(frameMember.quantity, left);
			if (quantity <= 0) continue;
			used.set(accessoryId, (used.get(accessoryId) ?? 0) + quantity);
			added.push({ itemId: accessoryId, quantity });
		}
		return { ...group, members: [...group.members, ...added] };
	});
}

// ============================================================================
// ID REMAPPING (client ids → persisted ids)
// ============================================================================

/** Translate member item ids; members whose id is not in the map are dropped. */
export function remapGroupItemIds<G extends ItemGroup>(
	groups: readonly G[],
	idMap: ReadonlyMap<string, string>
): G[] {
	return groups.map((group) => ({
		...group,
		members: group.members
			.filter((m) => idMap.has(m.itemId))
			.map((m) => ({ itemId: idMap.get(m.itemId) as string, quantity: m.quantity }))
	}));
}

/** Readable audit summary: "Sofía: Montura Nano ×1, Cristales ×1 · Trabajo 2: …". */
export function summarizeGroups(
	groups: readonly ItemGroup[],
	nameOf: (itemId: string) => string
): string {
	if (groups.length === 0) return 'Sin agrupación';
	return groups
		.map((group, index) => {
			const members = group.members.map((m) => `${nameOf(m.itemId)} ×${m.quantity}`).join(', ');
			return `${groupDisplayLabel(group.label, index)}: ${members || '—'}`;
		})
		.join(' · ');
}
