/**
 * Reactive per-person grouping state for wizard step 2 (sale and quote).
 * Reads the step's state through `source` and writes back through `write`.
 */
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { SaleItemRow } from '../newSaleTypes';
import type { IncludedAccessoryMap } from '../includedAccessories';
import {
	clampUiGroups,
	visibleGroupCount,
	type UiGroup,
	type WizardPersonsOptions
} from './groupsState';
import { applyWizardGroupsChange, orderWizardRows, wizardGroupItems } from './wizardGroups';
import { primaryFooterNote } from './primaryNote';

interface WizardPersonsSource {
	items: SaleItemRow[];
	groups: UiGroup[];
	accessoryMap: IncludedAccessoryMap;
	products: ProductWithRelations[];
	lenses: LensCatalogItemWithRelations[];
	persons: WizardPersonsOptions;
}

export class WizardPersons {
	open = $state(false);

	readonly items = $derived.by(() => {
		const s = this.source();
		return wizardGroupItems(s.items, s.products, s.lenses);
	});
	/** Allocations repaired against the current lines (removed line, lower qty). */
	readonly groups = $derived.by(() => clampUiGroups(this.source().groups, this.items));
	readonly count = $derived(visibleGroupCount(this.groups));
	readonly showPrimary = $derived.by(() => this.source().persons.showPrimary ?? false);
	readonly primaryLensId = $derived.by(() => this.source().persons.primaryLensId ?? null);
	readonly footerNote = $derived(
		this.showPrimary ? primaryFooterNote(this.items, this.groups, this.primaryLensId) : undefined
	);

	constructor(
		private readonly source: () => WizardPersonsSource,
		private readonly write: {
			groups: (groups: UiGroup[]) => void;
			items: (items: SaleItemRow[]) => void;
		}
	) {}

	/** Auto-included accessories follow their frame (also used inside the drawer draft). */
	previewChange = (previous: UiGroup[], next: UiGroup[]): UiGroup[] =>
		applyWizardGroupsChange(previous, next, this.items, this.source().accessoryMap);

	/** Auto-included accessories follow their frame. */
	change = (next: UiGroup[]) => {
		this.write.groups(this.previewChange(this.groups, next));
	};

	/** Commit a draft from the Personas drawer and reorder cards right away. */
	commit = (nextGroups: UiGroup[], nextPrimary: string | null) => {
		const finalGroups = clampUiGroups(nextGroups, this.items);
		this.write.groups(finalGroups);
		if (this.showPrimary && nextPrimary !== this.primaryLensId) {
			this.source().persons.onprimarychange?.(nextPrimary);
		}
		const rows = this.source().items;
		const reordered = orderWizardRows(rows, this.items, finalGroups);
		if (reordered.some((row, i) => row !== rows[i])) this.write.items(reordered);
	};

	/** Reorder cards by person only when a popover/drawer closes (cards never jump mid-edit). */
	reorder = () => {
		const rows = this.source().items;
		const next = orderWizardRows(rows, this.items, this.groups);
		if (next.some((row, i) => row !== rows[i])) this.write.items(next);
	};

	isPrimary(rowId: string): boolean {
		return this.showPrimary && this.primaryLensId === rowId;
	}
}
