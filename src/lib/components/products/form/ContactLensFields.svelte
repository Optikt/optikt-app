<script lang="ts">
	import { fieldLabelClass, getFieldClass } from './productFormClasses';
	import type { ProductFormData } from './productFormTypes';

	interface Props {
		formData: ProductFormData;
	}

	let { formData }: Props = $props();
</script>

<div class="xl:col-span-6">
	<label for="baseCurve" class={fieldLabelClass}>Curva base (BC)</label>
	<input
		id="baseCurve"
		name="baseCurve"
		type="number"
		min="5"
		max="10"
		step="0.1"
		bind:value={formData.baseCurve}
		placeholder="8.6"
		class={getFieldClass(null, 'font-mono tabular-nums')}
	/>
</div>

<div class="xl:col-span-6">
	<label for="diameter" class={fieldLabelClass}>Diámetro (mm)</label>
	<input
		id="diameter"
		name="diameter"
		type="number"
		min="8"
		max="20"
		step="0.1"
		bind:value={formData.diameter}
		placeholder="14.2"
		class={getFieldClass(null, 'font-mono tabular-nums')}
	/>
</div>
