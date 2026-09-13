<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Check, X } from '@lucide/svelte';
	import {
		ALL_TREATMENT_CATEGORIES,
		TreatmentCategory,
		TREATMENT_CATEGORY_LABELS
	} from '$lib/shared/enums';
	import { getFormErrorMessage } from '$lib/utils';
	import type { createSupplierTreatmentForm } from '$lib/remote/suppliers.remote';

	interface Props {
		supplierId: string;
		form: ReturnType<typeof createSupplierTreatmentForm.for>;
		taxable: boolean;
		onToggleTaxable: () => void;
		onCancel: () => void;
		onResult: () => Promise<void>;
	}

	let { supplierId, form, taxable, onToggleTaxable, onCancel, onResult }: Props = $props();
</script>

<form
	{...form.enhance(async ({ submit }) => {
		await submit();
		await onResult();
	})}
	class="space-y-3 rounded-lg border border-blue-200 bg-blue-50/30 p-3"
>
	<input type="hidden" name="supplierId" value={supplierId} />
	<div>
		<label for="create-name" class="mb-1 block text-[11px] font-medium text-slate-500">Nombre</label
		>
		<input
			id="create-name"
			name="name"
			type="text"
			class="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:ring-blue-500"
			placeholder="Nombre del tratamiento"
		/>
		{#if form.fields.name?.issues()}
			<p class="mt-1 text-xs text-red-500">
				{getFormErrorMessage(form.fields.name.issues())}
			</p>
		{/if}
	</div>
	<div class="flex items-center gap-3">
		<div class="flex-1">
			<label for="create-category" class="mb-1 block text-[11px] font-medium text-slate-500"
				>Categoría</label
			>
			<select
				id="create-category"
				name="category"
				value={TreatmentCategory.AR}
				class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none"
			>
				{#each ALL_TREATMENT_CATEGORIES as cat (cat)}
					<option value={cat}>{TREATMENT_CATEGORY_LABELS[cat]}</option>
				{/each}
			</select>
		</div>
		<div class="w-28">
			<label for="create-price" class="mb-1 block text-[11px] font-medium text-slate-500"
				>Costo</label
			>
			<input
				id="create-price"
				name="price"
				type="number"
				step="0.01"
				min="0"
				class="w-full rounded-md border border-slate-300 p-2 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="0.00"
			/>
			{#if form.fields.price?.issues()}
				<p class="mt-1 text-xs text-red-500">
					{getFormErrorMessage(form.fields.price.issues())}
				</p>
			{/if}
		</div>
		<div class="w-28">
			<label for="create-salePrice" class="mb-1 block text-[11px] font-medium text-slate-500"
				>Precio Venta</label
			>
			<input
				id="create-salePrice"
				name="salePrice"
				type="number"
				step="0.01"
				min="0"
				class="w-full rounded-md border border-slate-300 p-2 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="0.00"
			/>
		</div>
		<div class="flex items-center gap-2 pt-4">
			<input type="hidden" name="isTaxable" value={String(taxable)} />
			<button
				type="button"
				class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {taxable
					? 'bg-blue-600'
					: 'bg-slate-200'}"
				onclick={onToggleTaxable}
				role="switch"
				aria-checked={taxable}
				aria-label="IVA"
			>
				<span
					class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 {taxable
						? 'translate-x-4'
						: 'translate-x-0'}"
				></span>
			</button>
			<span class="text-xs text-slate-600">IVA</span>
		</div>
		<div class="flex gap-1 pt-4">
			<Button type="submit" size="xs" class="p-1.5">
				<Check class="h-3.5 w-3.5" />
			</Button>
			<Button type="button" size="xs" variant="outline" class="p-1.5" onclick={onCancel}>
				<X class="h-3.5 w-3.5" />
			</Button>
		</div>
	</div>
</form>
