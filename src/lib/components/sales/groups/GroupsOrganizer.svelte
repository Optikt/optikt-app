<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { saveSaleItemGroups } from '$lib/remote/sales/groups.remote';
	import { saveQuoteItemGroups } from '$lib/remote/quotes/commands.remote';
	import { getErrorMessage, logger } from '$lib/utils';
	import type { ItemGroup } from '$lib/shared/saleItemGroups';
	import PersonsDrawer from './PersonsDrawer.svelte';
	import { toSubmitGroups, toUiGroups, type GroupItemView, type UiGroup } from './groupsState';

	/**
	 * "Organizar" from the detail: groups-only save (also for completed sales —
	 * it touches no money nor inventory). Bottom sheet on narrow screens.
	 */
	interface Props {
		open: boolean;
		kind: 'sale' | 'quote';
		docId: string;
		docLabel: string;
		items: GroupItemView[];
		itemGroups: ItemGroup[];
		primaryLensItemId?: string | null;
		sheet?: boolean;
		onsaved?: () => void;
	}

	let {
		open = $bindable(),
		kind,
		docId,
		docLabel,
		items,
		itemGroups,
		primaryLensItemId = null,
		sheet = false,
		onsaved
	}: Props = $props();

	let groups = $state<UiGroup[]>([]);
	let primary = $state<string | null>(null);
	let saving = $state(false);
	let wasOpen = false;

	// Seed each time the drawer opens (not while editing).
	$effect.pre(() => {
		if (open && !wasOpen) {
			groups = toUiGroups(itemGroups);
			primary = primaryLensItemId;
		}
		wasOpen = open;
	});

	async function save() {
		saving = true;
		try {
			const payload = toSubmitGroups(groups);
			const result =
				kind === 'sale'
					? await saveSaleItemGroups({ saleId: docId, groups: payload, primaryLensItemId: primary })
					: await saveQuoteItemGroups({ quoteId: docId, groups: payload });
			if (!result.success) {
				toast.error(result.error);
				return;
			}
			if (kind === 'sale' && 'prescriptionCreated' in result && result.prescriptionCreated) {
				toast.success('Personas guardadas · nueva fórmula vigente del cliente');
			} else {
				toast.success('Personas guardadas');
			}
			open = false;
			onsaved?.();
		} catch (e) {
			logger.error('Error guardando personas', e);
			toast.error(getErrorMessage(e, 'No se pudieron guardar las personas'));
		} finally {
			saving = false;
		}
	}
</script>

<PersonsDrawer
	bind:open
	onclose={() => (open = false)}
	{docLabel}
	{items}
	{groups}
	onchange={(next) => (groups = next)}
	showPrimary={kind === 'sale'}
	primaryLensId={primary}
	onprimarychange={(id) => (primary = id)}
	onsave={save}
	{saving}
	{sheet}
/>
