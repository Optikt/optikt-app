/**
 * UI state helpers for per-person grouping (wizard, edit drawer, detail).
 * Pure: the shared allocation rules live in `$lib/shared/saleItemGroups`.
 */
import {
	clampAllocations,
	groupDisplayLabel,
	normalizeGroupsForSubmit,
	setMemberQuantity,
	type GroupMember,
	type GroupableItem,
	type ItemGroup
} from '$lib/shared/saleItemGroups';

/** A group being edited. `key` is a stable client key (Svelte `each` + popover state). */
export interface UiGroup extends ItemGroup {
	key: string;
}

/** A line as the grouping UI shows it. */
export interface GroupItemView extends GroupableItem {
	name: string;
	/** Short secondary text (Rx summary, SKU…). */
	detail?: string;
}

export interface PersonColor {
	dot: string;
	bg: string;
	fg: string;
}

/** Fixed palette (mockup): teal, orange, violet, blue, pink, olive — cycles after 6. */
const PALETTE: PersonColor[] = [
	{ dot: '#0f766e', bg: '#e0f2f1', fg: '#0b4f4a' },
	{ dot: '#c2410c', bg: '#fdeedd', fg: '#7a3000' },
	{ dot: '#6d28d9', bg: '#ede7fb', fg: '#43198f' },
	{ dot: '#1d4ed8', bg: '#dbeafe', fg: '#1e3a8a' },
	{ dot: '#be185d', bg: '#fce7f3', fg: '#831843' },
	{ dot: '#4d7c0f', bg: '#ecfccb', fg: '#365314' }
];

export function personColor(index: number): PersonColor {
	return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/** Two-letter avatar: "Sofía (hija)" → "SH", unnamed → "T2". */
export function personInitials(label: string | null | undefined, index: number): string {
	const words = (label ?? '').replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return `T${index + 1}`;
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
}

export function newUiGroup(label: string | null = null): UiGroup {
	return { key: crypto.randomUUID(), label, members: [] };
}

export function toUiGroups(groups: readonly ItemGroup[]): UiGroup[] {
	return groups.map((g) => ({
		key: crypto.randomUUID(),
		label: g.label,
		members: g.members.map((m) => ({ ...m }))
	}));
}

export function toSubmitGroups(groups: readonly UiGroup[]): ItemGroup[] {
	return normalizeGroupsForSubmit(groups);
}

/** qty 1 line: give it wholly to one group (or nobody with `null`). */
export function assignWhole(
	groups: readonly UiGroup[],
	groupIndex: number | null,
	item: GroupableItem
): UiGroup[] {
	const cleared = groups.map((g) => ({
		...g,
		members: g.members.filter((m) => m.itemId !== item.id)
	}));
	if (groupIndex === null) return cleared;
	return setMemberQuantity(cleared, groupIndex, item, item.quantity);
}

export function stepUnits(
	groups: readonly UiGroup[],
	groupIndex: number,
	item: GroupableItem,
	delta: number
): UiGroup[] {
	const current = memberQty(groups[groupIndex], item.id);
	return setMemberQuantity(groups, groupIndex, item, current + delta);
}

export function memberQty(group: ItemGroup | undefined, itemId: string): number {
	return group?.members.find((m) => m.itemId === itemId)?.quantity ?? 0;
}

export function renameGroup(groups: readonly UiGroup[], key: string, label: string): UiGroup[] {
	return groups.map((g) => (g.key === key ? { ...g, label } : g));
}

export function removeGroup(groups: readonly UiGroup[], key: string): UiGroup[] {
	return groups.filter((g) => g.key !== key);
}

/** Groups with members or a typed name count as "personas" in buttons/badges. */
export function visibleGroupCount(groups: readonly ItemGroup[]): number {
	return groups.filter((g) => g.members.length > 0 || (g.label ?? '').trim() !== '').length;
}

export function groupLabel(groups: readonly ItemGroup[], index: number): string {
	return groupDisplayLabel(groups[index]?.label, index);
}

/** Units of a group (badges "3 ítems"). */
export function groupUnits(group: ItemGroup): number {
	return group.members.reduce((sum, m: GroupMember) => sum + m.quantity, 0);
}

export function clampUiGroups(
	groups: readonly UiGroup[],
	items: readonly GroupableItem[]
): UiGroup[] {
	return clampAllocations(groups, items);
}

/** Lens lines of a group (the ⭐ applies to a lens). */
export function groupLensIds(group: ItemGroup, items: readonly GroupableItem[]): string[] {
	const lensIds = new Set(items.filter((i) => i.itemType === 'LENS_PAIR').map((i) => i.id));
	return group.members.filter((m) => lensIds.has(m.itemId)).map((m) => m.itemId);
}

/** Wizard step 2 options for the sale (⭐ primary) / quote (no primary). */
export interface WizardPersonsOptions {
	/** Sales only: ⭐ "Fórmula del cliente". */
	showPrimary?: boolean;
	primaryLensId?: string | null;
	onprimarychange?: (lensId: string | null) => void;
	/** Document chip in the Personas drawer ("#0313", "P-0019"). */
	docLabel?: string;
}
