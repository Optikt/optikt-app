<script lang="ts">
	import { Label } from 'flowbite-svelte';
	import { Input as FlowbiteInput } from 'flowbite-svelte';
	import { ALL_FREE_ITEM_CATEGORIES } from '$lib/shared/enums/lensTypes';
	import { getFreeItemCategoryLabel } from '$lib/shared/enums/lensTypes';

	interface Props {
		freeItem: import('../newSaleTypes').FreeItemData;
	}

	let { freeItem = $bindable() }: Props = $props();
</script>

<div class="space-y-3 rounded-lg bg-amber-50/60 p-3">
	<div class="grid gap-3 sm:grid-cols-2">
		<div>
			<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Categoría *</Label>
			<select
				bind:value={freeItem.category}
				class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
			>
				{#each ALL_FREE_ITEM_CATEGORIES as cat (cat)}
					<option value={cat}>{getFreeItemCategoryLabel(cat)}</option>
				{/each}
			</select>
		</div>
		<div>
			<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Descripción *</Label>
			<FlowbiteInput
				bind:value={freeItem.description}
				placeholder="LC Novak -2.50 miel, hidrogel..."
				maxlength={500}
			/>
		</div>
	</div>
	<div class="grid gap-3 sm:grid-cols-2">
		<div>
			<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Costo estimado</Label>
			<FlowbiteInput
				type="number"
				value={freeItem.unitCost ?? undefined}
				oninput={(event: Event) => {
					if (event.currentTarget instanceof HTMLInputElement) {
						const val = event.currentTarget.value;
						freeItem.unitCost = val === '' ? null : parseFloat(val);
					}
				}}
				placeholder="0.00"
				step="0.01"
				min="0"
				class="font-mono"
			/>
		</div>
		<div>
			<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Notas ópticas</Label>
			<FlowbiteInput
				bind:value={freeItem.opticalNotes}
				placeholder="OD -2.50 sph, color miel..."
				maxlength={1000}
			/>
		</div>
	</div>
</div>
