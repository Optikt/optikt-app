<script lang="ts">
	import PersonsEditor from '../groups/PersonsEditor.svelte';
	import { primaryNote } from '../groups/primaryNote';
	import type { EditPersons } from '../groups/editPersons.svelte';
	import EditSaleTabs from './EditSaleTabs.svelte';

	/** "Personas" tab of the edit drawer: names, unit split and (sales) the ⭐ primary. */
	interface Props {
		persons: EditPersons;
	}

	let { persons }: Props = $props();
</script>

<div class="flex flex-col gap-3 px-4 pt-3.5 pb-4">
	<div class="flex items-center gap-2">
		<h2 class="text-[11px] font-bold tracking-[0.08em] text-brand-navy uppercase">Artículos</h2>
		<EditSaleTabs
			tab={persons.tab}
			personCount={persons.count}
			onchange={(t) => (persons.tab = t)}
		/>
	</div>
	<PersonsEditor
		items={persons.items}
		groups={persons.groups}
		onchange={persons.change}
		showPrimary={persons.showPrimary}
		primaryLensId={persons.primary}
		onprimarychange={persons.setPrimary}
	/>
	{#if persons.showPrimary}
		<p class="rounded-lg bg-[#fff4c2] px-3 py-2 text-xs text-[#6f5900]">
			{primaryNote(persons.items, persons.groups, persons.primary)}
			{#if persons.primaryChanged && persons.primary}
				Al guardar se crea una fórmula vigente nueva; la anterior queda en el historial del cliente.
			{/if}
		</p>
	{/if}
</div>
