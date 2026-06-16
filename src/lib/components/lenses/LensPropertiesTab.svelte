<script lang="ts">
	import { FlaskConical, Cpu, Plus, Tags } from '@lucide/svelte';
	import LensMaterialsTab from './LensMaterialsTab.svelte';
	import LensTechnologiesTab from './LensTechnologiesTab.svelte';
	import LensDifferentiatorsTab from './LensDifferentiatorsTab.svelte';
	import type { LensMaterial, LensTechnology } from '$lib/server/db/schema';

	type SubTab = 'materials' | 'technologies' | 'differentiators';

	interface Props {
		initialMaterials: LensMaterial[];
		initialTechnologies: LensTechnology[];
		initialDifferentiators: string[];
		initialSuppliers: { id: string; name: string }[];
		canManage?: boolean;
	}

	let {
		initialMaterials,
		initialTechnologies,
		initialDifferentiators,
		initialSuppliers,
		canManage = true
	}: Props = $props();

	let activeSubTab = $state<SubTab>('materials');
	let drawTrigger = $state(0);

	const subTabs: { id: SubTab; label: string; icon: any }[] = [
		{ id: 'materials', label: 'Materiales', icon: FlaskConical },
		{ id: 'technologies', label: 'Tecnologías', icon: Cpu },
		{ id: 'differentiators', label: 'Etiquetas', icon: Tags }
	];

	const newButtonLabel = $derived.by(() => {
		switch (activeSubTab) {
			case 'materials':
				return 'Nuevo Material';
			case 'technologies':
				return 'Nueva Tecnología';
			default:
				return '';
		}
	});
</script>

<div class="flex items-center justify-between border-b border-outline-variant/50 pb-3">
	<div class="flex gap-5">
		{#each subTabs as tab (tab.id)}
			<button
				type="button"
				onclick={() => { activeSubTab = tab.id }}
				class="inline-flex items-center gap-1.5 border-b-2 pb-1 text-sm font-semibold transition-colors {activeSubTab ===
				tab.id
					? 'border-brand-blue text-brand-blue'
					: 'border-transparent text-on-surface-variant hover:text-on-surface'}"
			>
				<tab.icon class="h-4 w-4" />
				{tab.label}
			</button>
		{/each}
	</div>
	{#if canManage && activeSubTab !== 'differentiators'}
		<button
			type="button"
			onclick={() => { drawTrigger++ }}
			class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm"
		>
			<Plus class="h-4 w-4" />
			{newButtonLabel}
		</button>
	{/if}
</div>

<div class="mt-4">
	{#if activeSubTab === 'materials'}
		<LensMaterialsTab {initialMaterials} {canManage} {drawTrigger} />
	{:else if activeSubTab === 'technologies'}
		<LensTechnologiesTab {initialTechnologies} {initialSuppliers} {canManage} {drawTrigger} />
	{:else if activeSubTab === 'differentiators'}
		<LensDifferentiatorsTab {initialDifferentiators} {canManage} />
	{/if}
</div>
