/**
 * UI state helpers for per-person grouping (wizard, edit drawer, detail).
 * Pure: the shared allocation rules live in `$lib/shared/saleItemGroups`.
 */
import {
	chipModel,
	clampAllocations,
	groupCode,
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
	/** Soft row background in the detail "Lista" view for quick visual grouping. */
	rowBg: string;
	rowHover: string;
}

export interface RowTint {
	bg: string;
	hover: string;
	accent: string;
}

/** Fixed palette (mockup): teal, orange, violet, blue, pink, olive — cycles after 6. */
const PALETTE: PersonColor[] = [
	{ dot: '#0f766e', bg: '#d7f3ef', fg: '#0b4f4a', rowBg: '#eefaf8', rowHover: '#e0f5f2' },
	{ dot: '#c2410c', bg: '#fde6ce', fg: '#7a3000', rowBg: '#fff5eb', rowHover: '#feead6' },
	{ dot: '#6d28d9', bg: '#e9e0fb', fg: '#43198f', rowBg: '#f6f2fe', rowHover: '#ede4fd' },
	{ dot: '#1d4ed8', bg: '#d6e7fe', fg: '#1e3a8a', rowBg: '#f0f6ff', rowHover: '#e2eeff' },
	{ dot: '#be185d', bg: '#fce0ef', fg: '#831843', rowBg: '#fdf2f7', rowHover: '#fce4f0' },
	{ dot: '#4d7c0f', bg: '#e5f9be', fg: '#365314', rowBg: '#f6fce9', rowHover: '#ebfad0' }
];

const MULTI_PERSON_ROW: RowTint = { bg: '#f0f6ff', hover: '#e2eeff', accent: '#2563eb' };

export function personColor(index: number): PersonColor {
	return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/** Row tint for detail "Lista" view: person's color when single, blue when shared, null when unassigned. */
export function rowTintForItem(
	item: GroupableItem | undefined,
	groups: readonly ItemGroup[]
): RowTint | null {
	if (!item || groups.length === 0) return null;
	const chip = chipModel(item, groups);
	if (chip.state === 'none') return null;
	if (chip.state === 'multi') return MULTI_PERSON_ROW;
	const color = personColor(chip.shares[0].groupIndex);
	return { bg: color.rowBg, hover: color.rowHover, accent: color.dot };
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

/** Warning banner shown when editing a saved sale/quote that already generated group codes. */
export function reorganizeWarningMessage(
	kind: 'sale' | 'quote',
	savedGroups: readonly ItemGroup[],
	docLabel?: string
): string | undefined {
	if (savedGroups.length === 0) return undefined;
	const codes = savedGroups
		.map((_, i) => groupCode(docLabel, i))
		.filter((c): c is string => c !== null);
	const entity = kind === 'quote' ? 'Este presupuesto' : 'Esta venta';
	const suffix = codes.length > 0 ? ` (${codes.join(', ')})` : '';
	return `${entity} ya tiene identificadores asignados${suffix}. Reorganizar las personas puede cambiar estos códigos y desalinearlos con fórmulas enviadas al laboratorio.`;
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
