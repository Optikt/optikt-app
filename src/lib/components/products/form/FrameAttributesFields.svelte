<script lang="ts">
	import { fieldLabelClass, getFieldClass, helperTextClass } from './productFormClasses';
	import type { ProductFormData } from './productFormTypes';

	interface Props {
		formData: ProductFormData;
	}

	let { formData }: Props = $props();
</script>

<div class="xl:col-span-4">
	<label for="lensWidth" class={fieldLabelClass}>Calibre (mm)</label>
	<input
		id="lensWidth"
		name="lensWidth"
		type="number"
		min="1"
		max="99"
		bind:value={formData.lensWidth}
		placeholder="50"
		class={getFieldClass(null, 'font-mono tabular-nums')}
	/>
	<p class={helperTextClass}>Ancho del cristal</p>
</div>

<div class="xl:col-span-4">
	<label for="bridgeWidth" class={fieldLabelClass}>Puente (mm)</label>
	<input
		id="bridgeWidth"
		name="bridgeWidth"
		type="number"
		min="1"
		max="99"
		bind:value={formData.bridgeWidth}
		placeholder="22"
		class={getFieldClass(null, 'font-mono tabular-nums')}
	/>
	<p class={helperTextClass}>Ancho del puente nasal</p>
</div>

<div class="xl:col-span-4">
	<label for="templeLength" class={fieldLabelClass}>Varilla (mm)</label>
	<input
		id="templeLength"
		name="templeLength"
		type="number"
		min="1"
		max="999"
		bind:value={formData.templeLength}
		placeholder="145"
		class={getFieldClass(null, 'font-mono tabular-nums')}
	/>
	<p class={helperTextClass}>Longitud del brazo</p>
</div>
