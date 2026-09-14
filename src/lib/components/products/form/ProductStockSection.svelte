<script lang="ts">
	import { Boxes } from '@lucide/svelte';
	import {
		fieldLabelClass,
		getFieldClass,
		noteCardClass,
		sectionClass
	} from './productFormClasses';
	import type { ProductFormData } from './productFormTypes';

	interface Props {
		formData: ProductFormData;
		showStockFields: boolean;
		inventoryCopy: string;
	}

	let { formData, showStockFields, inventoryCopy }: Props = $props();
</script>

<section class={sectionClass}>
	<div class="mb-5 flex items-center gap-3">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/12 text-brand-blue"
		>
			<Boxes size={18} />
		</div>
		<div>
			<h2 class="font-heading text-xl font-semibold text-brand-navy">Gestion de stock</h2>
			<p class="text-sm text-on-surface-variant">Alertas y politica operativa</p>
		</div>
	</div>

	{#if showStockFields}
		<label for="minStock" class={fieldLabelClass}>Stock minimo (alerta)</label>
		<input
			id="minStock"
			name="minStock"
			type="number"
			min="0"
			bind:value={formData.minStock}
			class={getFieldClass(null, 'max-w-[10rem] font-mono tabular-nums')}
		/>

		<div class={`${noteCardClass} mt-4`}>
			<p class="text-[10px] font-bold tracking-[0.18em] text-brand-gold uppercase">Operacion</p>
			<p class="mt-2 text-sm text-on-surface-variant">{inventoryCopy}</p>
		</div>
	{:else}
		<div class={noteCardClass}>
			<p class="text-sm text-on-surface-variant">{inventoryCopy}</p>
		</div>
	{/if}
</section>
