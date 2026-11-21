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

	/** Auto-included accessories follow their frame. */
	change = (next: UiGroup[]) => {
		this.write.groups(
			applyWizardGroupsChange(this.groups, next, this.items, this.source().accessoryMap)
		);
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
