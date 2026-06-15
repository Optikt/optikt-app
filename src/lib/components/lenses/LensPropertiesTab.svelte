<script lang="ts">
	import { FlaskConical, Cpu, Tags } from '@lucide/svelte';
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

	const subTabs: { id: SubTab; label: string; icon: any }[] = [
		{ id: 'materials', label: 'Materiales', icon: FlaskConical },
		{ id: 'technologies', label: 'Tecnologías', icon: Cpu },
		{ id: 'differentiators', label: 'Etiquetas', icon: Tags }
	];
</script>

<div class="space-y-6">
	<div class="flex items-center justify-center">
		<div class="inline-flex rounded-2xl bg-surface-container-high p-1 shadow-sm">
			{#each subTabs as tab (tab.id)}
				<button
					type="button"
					onclick={() => (activeSubTab = tab.id)}
					aria-pressed={activeSubTab === tab.id}
					class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors {activeSubTab === tab.id
						? 'bg-brand-navy text-white'
						: 'text-on-surface-variant hover:bg-surface-container-lowest'}"
				>
					<tab.icon class="h-3.5 w-3.5" />
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	{#if activeSubTab === 'materials'}
		<LensMaterialsTab {initialMaterials} {canManage} />
	{:else if activeSubTab === 'technologies'}
		<LensTechnologiesTab {initialTechnologies} {initialSuppliers} {canManage} />
	{:else if activeSubTab === 'differentiators'}
		<LensDifferentiatorsTab {initialDifferentiators} {canManage} />
	{/if}
</div>
