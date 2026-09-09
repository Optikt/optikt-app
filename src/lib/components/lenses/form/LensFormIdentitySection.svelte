<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { CreatableSelect, type SelectOption } from '$lib/components/ui';
	import {
		ALL_LENS_TYPES,
		LensCatalogSource,
		getLensTypeLabel
	} from '$lib/shared/enums';
	import {
		fieldLabelClass,
		formCardClass,
		helperTextClass,
		sectionTitleClass
	} from './lensFormClasses';
	import type { CatalogListEntry, LensCatalogFormData } from './lensFormTypes';

	interface Props {
		formData: LensCatalogFormData;
		supplierOptions: SelectOption[];
		materialOptions: SelectOption[];
		supplierTechnologies: CatalogListEntry[];
		isGlobalTechnology: boolean;
		supplierHelperText: string;
		materialHelperText: string;
		technologyHelperText: string;
		differentiatorHelperText: string;
		supplierError: string | null;
		materialError: string | null;
		nameError: string | null;
		autoNameEnabled: boolean;
		differentiatorsText: string;
		arColorsText: string;
		photochromicColorsText: string;
		onSupplierChange: (selected: { id: string; name: string } | null) => void;
		onCreatePendingSupplier: (name: string) => SelectOption;
		onCreatePendingMaterial: (name: string) => SelectOption;
		onCreatePendingTechnology: (name: string) => SelectOption;
	}

	let {
		formData = $bindable(),
		supplierOptions,
		materialOptions,
		supplierTechnologies,
		isGlobalTechnology = $bindable(),
		supplierHelperText,
		materialHelperText,
		technologyHelperText,
		differentiatorHelperText,
		supplierError,
		materialError,
		nameError,
		autoNameEnabled = $bindable(),
		differentiatorsText = $bindable(),
		arColorsText = $bindable(),
		photochromicColorsText = $bindable(),
		onSupplierChange,
		onCreatePendingSupplier,
		onCreatePendingMaterial,
		onCreatePendingTechnology
	}: Props = $props();
</script>

<section class={formCardClass}>
	<div class="flex items-center gap-2">
		<span class="h-2 w-2 rounded-full bg-brand-gold"></span>
		<h3 class={sectionTitleClass}>Identificacion del producto</h3>
	</div>

	<div class="mt-6 grid gap-x-6 gap-y-5 md:grid-cols-2">
		<div>
			<CreatableSelect
				label="Proveedor"
				name="supplierId"
				value={formData.supplierId}
				options={supplierOptions}
				placeholder="Ej: Novak"
				required
				creatable
				onCreatePending={onCreatePendingSupplier}
				onchange={onSupplierChange}
				error={supplierError}
			/>
			<p class={helperTextClass}>{supplierHelperText}</p>
		</div>

		<div>
			<CreatableSelect
				label="Material"
				name="materialId"
				bind:value={formData.materialId}
				options={materialOptions}
				placeholder="Ej: Policarbonato"
				required
				creatable
				onCreatePending={onCreatePendingMaterial}
				error={materialError}
			/>
			<p
				class="mt-1.5 text-xs {formData.materialId.startsWith('pending_')
					? 'text-error'
					: 'text-on-surface-variant'}"
			>
				{materialHelperText}
			</p>
		</div>

		<div>
			<p class={fieldLabelClass}>Origen (fuente)</p>
			<div class="mt-2 flex rounded-lg bg-surface-container-low p-1">
				<button
					type="button"
					class="flex-1 rounded-md px-3 py-2 text-[10px] font-bold tracking-[0.14em] uppercase transition-all {formData.source ===
					LensCatalogSource.FINISHED
						? 'bg-white text-brand-navy shadow-sm'
						: 'text-outline hover:text-brand-navy'}"
					onclick={() => (formData.source = LensCatalogSource.FINISHED)}>Terminado</button
				>
				<button
					type="button"
					class="flex-1 rounded-md px-3 py-2 text-[10px] font-bold tracking-[0.14em] uppercase transition-all {formData.source ===
					LensCatalogSource.LAB
						? 'bg-white text-brand-navy shadow-sm'
						: 'text-outline hover:text-brand-navy'}"
					onclick={() => (formData.source = LensCatalogSource.LAB)}>Laboratorio</button
				>
			</div>
		</div>

		<div>
			<Label for="lc_type" class={fieldLabelClass}>Tipo de lente</Label>
			<select
				id="lc_type"
				name="type"
				bind:value={formData.type}
				required
				class="mt-2 rounded-xl border-0 bg-surface-container-low"
			>
				{#each ALL_LENS_TYPES as t (t)}
					<option value={t}>{getLensTypeLabel(t)}</option>
				{/each}
			</select>
		</div>

		<div>
			<!-- <div>
					<CreatableSelect
						label="Proveedor"
						name="supplierId"
						value={formData.supplierId}
						options={supplierOptions}
						placeholder="Ej: Novak"
						required
						creatable
						onCreatePending={onCreatePendingSupplier}
						onchange={onSupplierChange}
						error={supplierError}
					/>
					<p class={helperTextClass}>{supplierHelperText}</p>
				</div> -->
			<!--  -->
			<CreatableSelect
				label="Tecnología de fabricación"
				name="technologyId"
				value={formData.technologyId}
				options={supplierTechnologies}
				placeholder="Sin tecnología / diseño digital"
				creatable
				onCreatePending={onCreatePendingTechnology}
				onchange={(selected) => {
					formData.technologyId = selected?.id ?? '';
				}}
			/>
			<div class="mt-1.5 flex items-center gap-2">
				<input
					type="checkbox"
					id="lc_global_tech"
					bind:checked={isGlobalTechnology}
					class="h-3.5 w-3.5 rounded border-outline-variant"
					disabled={!formData.supplierId || formData.supplierId.startsWith('pending_')}
				/>
				<Label for="lc_global_tech" class="text-[11px] font-medium text-on-surface-variant"
					>Tecnología global (aplica a todos los proveedores)</Label
				>
			</div>
			<p class={helperTextClass}>
				{#if supplierTechnologies.length === 0}
					{formData.supplierId && !formData.supplierId.startsWith('pending_')
						? 'No hay tecnologías globales ni específicas para este proveedor.'
						: 'No hay tecnologías globales registradas.'}
				{:else}
					{technologyHelperText}
				{/if}
			</p>
		</div>

		<div>
			<Label for="lc_differentiators" class={fieldLabelClass}
				>Etiquetas / Diferenciadores</Label
			>
			<input
				id="lc_differentiators"
				bind:value={differentiatorsText}
				placeholder="Ej: Cilindro Alto 2, UV400, Extra Delgado"
				class="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-outline focus:ring-2 focus:ring-brand-blue focus:outline-none"
			/>
			<p class={helperTextClass}>{differentiatorHelperText}</p>
		</div>

		<div class="md:col-span-2">
			<div class="mb-2 flex items-center justify-between">
				<Label for="lc_name" class={fieldLabelClass}>Nombre tecnico</Label>
				<label
					class="flex items-center gap-2 text-[11px] font-medium text-on-surface-variant"
				>
					<input
						type="checkbox"
						bind:checked={autoNameEnabled}
						class="h-3.5 w-3.5 rounded border-outline-variant"
					/>
					Auto-generar
				</label>
			</div>
			{#if autoNameEnabled}
				<input type="hidden" name="name" value={formData.name} />
			{/if}
			<input
				id="lc_name"
				name={autoNameEnabled ? undefined : 'name'}
				bind:value={formData.name}
				placeholder="Ej: Novak · Policarbonato · Monofocal"
				class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-outline focus:ring-2 focus:ring-brand-blue focus:outline-none"
				required
				disabled={autoNameEnabled}
			/>
			{#if nameError}
				<p class="mt-1 text-xs text-error">
					{nameError}
				</p>
			{:else if autoNameEnabled}
				<p class={helperTextClass}>
					Se genera automaticamente con proveedor, material, tecnologia, etiqueta,
					tratamientos y tipo.
				</p>
			{/if}
		</div>

		<div class="border-t border-outline-variant/20 pt-4 md:col-span-2">
			<p class={fieldLabelClass}>Tratamientos y colores</p>
			<div class="mt-4 grid gap-4 md:grid-cols-3">
				<div class="space-y-2">
					<label
						class="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm font-medium text-brand-navy"
					>
						<span>Antirreflejo (AR)</span>
						<input
							type="checkbox"
							bind:checked={formData.hasAr}
							class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue"
						/>
					</label>
					{#if formData.hasAr}
						<div>
							<Label
								for="lc_ar_colors"
								class="text-[10px] font-semibold tracking-wider text-outline uppercase"
								>Colores AR</Label
							>
							<input
								id="lc_ar_colors"
								bind:value={arColorsText}
								placeholder="Ej: Verde, Azul"
								class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-outline focus:ring-2 focus:ring-brand-blue focus:outline-none"
							/>
						</div>
					{/if}
				</div>

				<div class="space-y-2">
					<label
						class="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm font-medium text-brand-navy"
					>
						<span>Proteccion Bluecut</span>
						<input
							type="checkbox"
							bind:checked={formData.hasBluecut}
							class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue"
						/>
					</label>
				</div>

				<div class="space-y-2">
					<label
						class="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm font-medium text-brand-navy"
					>
						<span>Fotocromatico</span>
						<input
							type="checkbox"
							bind:checked={formData.isPhotochromic}
							class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue"
						/>
					</label>
					{#if formData.isPhotochromic}
						<div>
							<Label
								for="lc_photochromic_colors"
								class="text-[10px] font-semibold tracking-wider text-outline uppercase"
								>Colores Fotocromático</Label
							>
							<input
								id="lc_photochromic_colors"
								bind:value={photochromicColorsText}
								placeholder="Ej: Gris, Café"
								class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-outline focus:ring-2 focus:ring-brand-blue focus:outline-none"
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
