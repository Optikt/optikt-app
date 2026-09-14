<script lang="ts">
	import { Lock, Package2 } from '@lucide/svelte';
	import { CreatableSelect, type SelectOption } from '$lib/components/ui';
	import { ALL_PRODUCT_TYPES, PRODUCT_TYPE_LABELS } from '$lib/shared/enums';
	import {
		errorTextClass,
		fieldLabelClass,
		genderOptions,
		getFieldClass,
		sectionClass
	} from './productFormClasses';
	import type { ProductFormData } from './productFormTypes';
	import ContactLensFields from './ContactLensFields.svelte';
	import FrameAttributesFields from './FrameAttributesFields.svelte';

	interface MaterialOption extends SelectOption {
		productType?: string;
	}

	interface Props {
		formData: ProductFormData;
		isAutoSku: boolean;
		orderedBrands: SelectOption[];
		orderedSuppliers: SelectOption[];
		allMaterials: MaterialOption[];
		showFrameAttributes: boolean;
		showContactLensAttributes: boolean;
		showGenericSize: boolean;
		skuError: string | null;
		nameError: string | null;
		typeError: string | null;
		brandError: string | null;
		supplierError: string | null;
		materialError: string | null;
		onCreatePendingBrand: (name: string) => SelectOption;
		onCreatePendingSupplier: (name: string) => SelectOption;
		onCreatePendingMaterial: (name: string) => SelectOption;
	}

	let {
		formData,
		isAutoSku = $bindable(),
		orderedBrands,
		orderedSuppliers,
		allMaterials,
		showFrameAttributes,
		showContactLensAttributes,
		showGenericSize,
		skuError,
		nameError,
		typeError,
		brandError,
		supplierError,
		materialError,
		onCreatePendingBrand,
		onCreatePendingSupplier,
		onCreatePendingMaterial
	}: Props = $props();
</script>

<section class={sectionClass}>
	<div class="mb-6 flex items-center gap-3">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/12 text-brand-blue"
		>
			<Package2 size={18} />
		</div>
		<div>
			<h2 class="font-heading text-xl font-semibold text-brand-navy">Informacion general</h2>
		</div>
	</div>

	<div class="grid gap-5 md:grid-cols-2 xl:grid-cols-12">
		<div class="xl:col-span-7">
			<div class="mb-1.5 flex items-center justify-between gap-3">
				<label for="sku" class={fieldLabelClass}>Codigo SKU</label>
				<label class="inline-flex items-center gap-2 text-[11px] font-semibold text-brand-blue">
					<input
						type="checkbox"
						bind:checked={isAutoSku}
						class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue/20"
					/>
					Autogenerar
				</label>
			</div>
			<div class="relative">
				<input
					id="sku"
					name="sku"
					bind:value={formData.sku}
					readonly={isAutoSku}
					placeholder="OPT-2026-0001"
					class={getFieldClass(skuError, 'pr-10 font-mono tracking-[0.18em] uppercase')}
					aria-invalid={!!skuError}
					data-field-error={skuError ? 'true' : undefined}
				/>
				{#if isAutoSku}
					<div
						class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-outline"
					>
						<Lock size={16} />
					</div>
				{/if}
			</div>
			{#if skuError}
				<p class={errorTextClass}>{skuError}</p>
			{/if}
		</div>

		<div class="xl:col-span-5">
			<label for="type" class={fieldLabelClass}>Tipo de producto</label>
			<select
				id="type"
				name="type"
				bind:value={formData.type}
				required
				class={getFieldClass(typeError)}
				aria-invalid={!!typeError}
				data-field-error={typeError ? 'true' : undefined}
			>
				{#each ALL_PRODUCT_TYPES as productTypeOption (productTypeOption)}
					<option value={productTypeOption}>{PRODUCT_TYPE_LABELS[productTypeOption]}</option>
				{/each}
			</select>
			{#if typeError}
				<p class={errorTextClass}>{typeError}</p>
			{/if}
		</div>

		<div class="xl:col-span-4">
			<label for="personalCode" class={fieldLabelClass}>Codigo propio</label>
			<input
				id="personalCode"
				name="personalCode"
				bind:value={formData.personalCode}
				placeholder="82"
				class={getFieldClass(null, 'font-mono tracking-[0.16em] uppercase')}
			/>
		</div>

		<div class="md:col-span-2 xl:col-span-8">
			<label for="name" class={fieldLabelClass}>Nombre del producto</label>
			<input
				id="name"
				name="name"
				bind:value={formData.name}
				required
				placeholder="Ej: Ray-Ban Wayfarer Classic Black"
				class={getFieldClass(nameError)}
				aria-invalid={!!nameError}
				data-field-error={nameError ? 'true' : undefined}
			/>
			{#if nameError}
				<p class={errorTextClass}>{nameError}</p>
			{/if}
		</div>

		<div class="xl:col-span-4">
			<CreatableSelect
				label="Marca"
				labelClass={fieldLabelClass}
				name="brandId"
				placeholder="Buscar marca..."
				bind:value={formData.brandId}
				options={orderedBrands}
				creatable
				onCreatePending={onCreatePendingBrand}
				error={brandError}
			/>
		</div>

		<div class="xl:col-span-4">
			<CreatableSelect
				label="Proveedor"
				labelClass={fieldLabelClass}
				name="supplierId"
				placeholder="Buscar proveedor..."
				bind:value={formData.supplierId}
				options={orderedSuppliers}
				creatable
				onCreatePending={onCreatePendingSupplier}
				error={supplierError}
			/>
		</div>

		<div class="xl:col-span-4">
			<CreatableSelect
				label="Material"
				labelClass={fieldLabelClass}
				name="materialId"
				placeholder="Buscar material..."
				bind:value={formData.materialId}
				options={allMaterials}
				creatable
				onCreatePending={onCreatePendingMaterial}
				error={materialError}
			/>
		</div>

		<fieldset class="md:col-span-1 xl:col-span-8">
			<legend class={fieldLabelClass}>Genero</legend>
			<input type="hidden" name="gender" value={formData.gender} />
			<div class="mt-2 flex flex-wrap gap-2">
				{#each genderOptions as [value, label] (value)}
					<button
						type="button"
						onclick={() => {
							formData.gender = value;
						}}
						class={`rounded-lg px-4 py-2 text-xs font-bold tracking-[0.14em] uppercase transition-colors ${
							formData.gender === value
								? 'bg-brand-blue text-white shadow-sm'
								: 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
						}`}
					>
						{label}
					</button>
				{/each}
			</div>
		</fieldset>

		<div class="md:col-span-1 xl:col-span-4">
			<label for="color" class={fieldLabelClass}>Color / tinte</label>
			<input
				id="color"
				name="color"
				bind:value={formData.color}
				placeholder="Matte Black / G-15 Green"
				class={getFieldClass(null)}
			/>
		</div>

		{#if showFrameAttributes}
			<FrameAttributesFields {formData} />
		{/if}

		{#if showContactLensAttributes}
			<ContactLensFields {formData} />
		{/if}

		{#if showGenericSize}
			<div class="xl:col-span-6">
				<label for="size" class={fieldLabelClass}>Tamaño</label>
				<input
					id="size"
					name="size"
					bind:value={formData.size}
					placeholder="M / L / XL"
					class={getFieldClass(null)}
				/>
			</div>
		{/if}

		<div class="md:col-span-2 xl:col-span-12">
			<label for="description" class={fieldLabelClass}>Descripcion</label>
			<textarea
				id="description"
				name="description"
				bind:value={formData.description}
				rows="4"
				placeholder="Detalles tecnicos, bisagra, materiales especiales o indicaciones del producto..."
				class={`${getFieldClass(null)} resize-none`}></textarea>
		</div>
	</div>
</section>
