<script lang="ts">
	import { ImagePlus } from '@lucide/svelte';
	import {
		errorTextClass,
		fieldLabelClass,
		getFieldClass,
		sectionClass
	} from './productFormClasses';
	import type { ProductFormData } from './productFormTypes';

	interface Props {
		formData: ProductFormData;
		imagePreviewAvailable: boolean;
		previewAlt: string;
		imageError: string | null;
	}

	let { formData, imagePreviewAvailable, previewAlt, imageError }: Props = $props();
</script>

<section class={sectionClass}>
	<div class="mb-5 flex items-center gap-3">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/12 text-brand-blue"
		>
			<ImagePlus size={18} />
		</div>
		<div>
			<h2 class="font-heading text-xl font-semibold text-brand-navy">Imagen de referencia</h2>
		</div>
	</div>

	<div
		class="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low p-4"
	>
		{#if imagePreviewAvailable}
			<img
				src={formData.imageUrl}
				alt={`Vista previa de ${previewAlt}`}
				class="h-52 w-full rounded-lg bg-white object-cover"
			/>
		{:else}
			<div
				class="flex min-h-52 flex-col items-center justify-center text-center text-on-surface-variant"
			>
				<ImagePlus size={28} class="text-outline" />
				<p class="mt-3 text-[10px] font-bold tracking-[0.18em] uppercase">Sin imagen aun</p>
				<p class="mt-2 max-w-[15rem] text-xs text-outline">
					Pega una URL para usarla como referencia visual en la ficha del producto.
				</p>
			</div>
		{/if}
	</div>

	<div class="mt-4">
		<label for="imageUrl" class={fieldLabelClass}>URL de imagen</label>
		<input
			id="imageUrl"
			name="imageUrl"
			type="url"
			bind:value={formData.imageUrl}
			placeholder="https://..."
			class={getFieldClass(imageError)}
			aria-invalid={!!imageError}
			data-field-error={imageError ? 'true' : undefined}
		/>
		{#if imageError}
			<p class={errorTextClass}>{imageError}</p>
		{/if}
	</div>
</section>
