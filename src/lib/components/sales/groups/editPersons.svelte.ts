/**
 * Reactive per-person grouping state for the edit drawer (sale or quote):
 * seeded on open, compared to the seed to know what to send.
 */
import type { ItemGroup } from '$lib/shared/saleItemGroups';
import type { EditableItem } from '../editSaleDraft';
import { getCachedProducts } from '../catalogCache.svelte';
import type { GroupsPatch } from '../editSale/submitEditSale';
import {
	clampUiGroups,
	reorganizeWarningMessage,
	toSubmitGroups,
	toUiGroups,
	visibleGroupCount,
	type UiGroup
} from './groupsState';
import { editableGroupItems, groupsSignature } from './editGroups';

interface EditPersonsSource {
	mode: 'sale' | 'quote';
	docLabel?: string;
	editable: EditableItem[];
	/** Persisted lines (product type for the display order). */
	lines: readonly { productId: string | null; product: { type: string } | null }[];
}

export class EditPersons {
	tab = $state<'items' | 'persons'>('items');
	groupsRaw = $state<UiGroup[]>([]);
	primaryRaw = $state<string | null>(null);
	confirmReorganize = $state(false);
	seedGroups = $state<ItemGroup[]>([]);
	private seedSig = $state('');
	private seedPrimary = $state<string | null>(null);

	readonly docLabel = $derived.by(() => this.source().docLabel);
	readonly items = $derived.by(() => {
		const { editable, lines } = this.source();
		// Plain lookup rebuilt per derivation (never mutated): no SvelteMap needed.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const types = new Map<string, string | null>(getCachedProducts().map((p) => [p.id, p.type]));
		for (const l of lines) {
			if (l.productId && l.product?.type) types.set(l.productId, l.product.type);
		}
		return editableGroupItems(editable, types);
	});
	readonly groups = $derived.by(() => clampUiGroups(this.groupsRaw, this.items));
	readonly submitted = $derived.by(() => toSubmitGroups(this.groups));
	readonly count = $derived.by(() => visibleGroupCount(this.groups));
	readonly showPrimary = $derived.by(() => this.source().mode === 'sale');
	readonly primary = $derived.by(() =>
		this.primaryRaw &&
		this.items.some((i) => i.id === this.primaryRaw && i.itemType === 'LENS_PAIR')
			? this.primaryRaw
			: null
	);
	readonly groupsChanged = $derived.by(() => groupsSignature(this.submitted) !== this.seedSig);
	readonly primaryChanged = $derived.by(
		() => this.showPrimary && this.primary !== this.seedPrimary
	);
	readonly changed = $derived.by(() => this.groupsChanged || this.primaryChanged);
	readonly hadSavedGroups = $derived.by(() => this.seedGroups.length > 0);
	readonly needsReorganizeConfirm = $derived.by(() => this.hadSavedGroups && this.groupsChanged);
	readonly warningMessage = $derived.by(() =>
		reorganizeWarningMessage(this.source().mode, this.seedGroups, this.docLabel)
	);

	constructor(private readonly source: () => EditPersonsSource) {}

	seed(itemGroups: readonly ItemGroup[], primaryLensItemId: string | null) {
		this.tab = 'items';
		this.confirmReorganize = false;
		this.seedGroups = itemGroups.map((g) => ({
			label: g.label,
			members: g.members.map((m) => ({ ...m }))
		}));
		this.groupsRaw = toUiGroups(itemGroups);
		this.seedSig = groupsSignature(toSubmitGroups(this.groupsRaw));
		this.primaryRaw = primaryLensItemId;
		this.seedPrimary = primaryLensItemId;
	}

	change = (next: UiGroup[]) => {
		this.groupsRaw = next;
	};

	setPrimary = (lensId: string | null) => {
		this.primaryRaw = lensId;
	};

	/** Only what changed (absent = server keeps/remaps the current value). */
	patch(): GroupsPatch {
		return {
			groups: this.groupsChanged ? toSubmitGroups(this.groups) : undefined,
			primaryLensItemId: this.primaryChanged ? this.primary : undefined
		};
	}
}
