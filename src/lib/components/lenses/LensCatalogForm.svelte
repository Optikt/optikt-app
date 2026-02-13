<script lang="ts">
	import { Button, Label, Input, Select, Checkbox, Textarea } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { createLensCatalogItemForm, updateLensCatalogItemForm } from '$lib/remote/lenses.remote';
	import { CreatableSelect, type SelectOption, type PendingEntity } from '$lib/components/ui';
	import {
		LensType,
		LensCatalogSource,
		LENS_TYPE_LABELS,
		LENS_SOURCE_LABELS
	} from '$lib/shared/enums';
	import { scrollToFirstError } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import type { LensCatalogItem, LensOpticalRange } from '$lib/server/db/schema';

	type MaterialOption = SelectOption & { refractiveIndex?: number | null };

	/** UI-level range entry (before expansion) */
	type RangeEntry = {
		symmetric: boolean;
		absMin: string;
		absMax: string;
		sphereMin: string;
		sphereMax: string;
		cylinderMin: string;
		cylinderMax: string;
		additionMin: string;
		additionMax: string;
	};

	type Props = {
		item?: LensCatalogItem | null;
		existingRanges?: LensOpticalRange[];
		materials: { id: string; name: string; refractiveIndex?: number | null }[];
		suppliers: { id: string; name: string }[];
		cancelHref?: string;
	};

	let {
		item = null,
		existingRanges = [],
		materials = [],
		suppliers = [],
		cancelHref = '/lenses'
	}: Props = $props();

	let isSubmitting = $state(false);
	const isEdit = $derived(!!item);

	// Form instance
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		untrack(() => {
			formInstanceId = generateUUID();
		});
	});

	const currentCreateForm = $derived(createLensCatalogItemForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateLensCatalogItemForm.for(`${item?.id}-${formInstanceId}`)
	);
	const activeForm = $derived(isEdit ? currentUpdateForm : currentCreateForm);

	// Pending entities
	let pendingSuppliers = $state<PendingEntity[]>([]);
	let pendingMaterials = $state<PendingEntity[]>([]);

	// Form data — numeric fields are strings because they bind to <Input type="number">
	let formData = $state({
		source: LensCatalogSource.LAB as LensCatalogSource,
		supplierId: '',
		name: '',
		brand: '',
		technology: '',
		type: LensType.MONOFOCAL as LensType,
		materialId: '',
		isPhotochromic: false,
		isBlueCut: false,
		isAR: false,
		basePrice: '0',
		salePrice: '',
		mountingPrice: '',
		deliveryDays: '',
		stock: '0',
		refractiveIndex: '',
		notes: ''
	});

	// Dynamic optical ranges
	function createEmptyRange(): RangeEntry {
		return {
			symmetric: true,
			absMin: '0.00',
			absMax: '0.00',
			sphereMin: '0.00',
			sphereMax: '0.00',
			cylinderMin: '',
			cylinderMax: '',
			additionMin: '',
			additionMax: ''
		};
	}

	let ranges = $state<RangeEntry[]>([createEmptyRange()]);

	// Initialize when editing
	$effect(() => {
		if (item) {
			untrack(() => {
				formData = {
					source: item!.source as LensCatalogSource,
					supplierId: item!.supplierId,
					name: item!.name,
					brand: item!.brand ?? '',
					technology: item!.technology ?? '',
					type: item!.type as LensType,
					materialId: item!.materialId,
					isPhotochromic: item!.isPhotochromic,
					isBlueCut: item!.isBlueCut,
					isAR: item!.isAR,
					basePrice: item!.basePrice.toString(),
					salePrice: item!.salePrice?.toString() ?? '',
					mountingPrice: item!.mountingPrice?.toString() ?? '',
					deliveryDays: item!.deliveryDays?.toString() ?? '',
					stock: item!.stock?.toString() ?? '0',
					refractiveIndex: item!.refractiveIndex?.toString() ?? '',
					notes: item!.notes ?? ''
				};

				// Load existing ranges
				if (existingRanges.length > 0) {
					ranges = existingRanges.map((r) => ({
						symmetric: false,
						absMin: '0.00',
						absMax: '0.00',
						sphereMin: r.sphereMin.toFixed(2),
						sphereMax: r.sphereMax.toFixed(2),
						cylinderMin: r.cylinderMin != null ? r.cylinderMin.toFixed(2) : '',
						cylinderMax: r.cylinderMax != null ? r.cylinderMax.toFixed(2) : '',
						additionMin: r.additionMin != null ? r.additionMin.toFixed(2) : '',
						additionMax: r.additionMax != null ? r.additionMax.toFixed(2) : ''
					}));
				}
			});
		}
	});

	const showAddition = $derived(
		formData.type === LensType.PROGRESSIVE ||
			formData.type === LensType.BIFOCAL ||
			formData.type === LensType.OCCUPATIONAL
	);

	const isFinished = $derived(formData.source === LensCatalogSource.FINISHED);

	// Material/supplier options for CreatableSelect
	const materialOptions = $derived<MaterialOption[]>(
		materials.map((m) => ({
			id: m.id,
			name: m.refractiveIndex ? `${m.name} (${m.refractiveIndex})` : m.name,
			refractiveIndex: m.refractiveIndex
		}))
	);

	const supplierOptions = $derived<SelectOption[]>(
		suppliers.map((s) => ({ id: s.id, name: s.name }))
	);

	// Auto-fill refractive index from selected material
	$effect(() => {
		const selectedMat = materials.find((m) => m.id === formData.materialId);
		if (selectedMat?.refractiveIndex) {
			untrack(() => {
				formData.refractiveIndex = selectedMat.refractiveIndex!.toString();
			});
		}
	});

	// Auto-name generation
	// TODO: Check if the untrack is necessary
	let autoNameEnabled = $state(untrack(() => !item)); // Auto-name only for new items

	const autoGeneratedName = $derived(() => {
		if (!autoNameEnabled) return '';
		const parts: string[] = [];

		// Supplier name
		const sup = suppliers.find((s) => s.id === formData.supplierId);
		const pendingSup = pendingSuppliers.find((s) => s.pendingId === formData.supplierId);
		if (sup) parts.push(sup.name);
		else if (pendingSup) parts.push(pendingSup.name);

		// Material name
		const mat = materials.find((m) => m.id === formData.materialId);
		const pendingMat = pendingMaterials.find((m) => m.pendingId === formData.materialId);
		if (mat) parts.push(mat.name);
		else if (pendingMat) parts.push(pendingMat.name);

		// Type
		const typeLabel = LENS_TYPE_LABELS[formData.type as keyof typeof LENS_TYPE_LABELS];
		if (typeLabel) parts.push(typeLabel);

		// Technology
		if (formData.technology) parts.push(formData.technology);

		return parts.join(' · ');
	});

	// Apply auto-name when deps change
	$effect(() => {
		const name = autoGeneratedName();
		if (autoNameEnabled && name) {
			untrack(() => {
				formData.name = name;
			});
		}
	});

	// ── Range helpers ────────────────────────────────────────────
	function addRange() {
		ranges = [...ranges, createEmptyRange()];
	}

	function removeRange(index: number) {
		if (ranges.length <= 1) return;
		ranges = ranges.filter((_, i) => i !== index);
	}

	/**
	 * Expand UI range entries into flat DB range objects.
	 * When symmetric (±) is ON:
	 *   - If absMin is 0: one continuous range from -absMax to +absMax
	 *   - Otherwise: two ranges (negative side and positive side)
	 */
	function expandRanges(): {
		sphereMin: number;
		sphereMax: number;
		cylinderMin?: number;
		cylinderMax?: number;
		additionMin?: number;
		additionMax?: number;
	}[] {
		const result: {
			sphereMin: number;
			sphereMax: number;
			cylinderMin?: number;
			cylinderMax?: number;
			additionMin?: number;
			additionMax?: number;
		}[] = [];

		for (const r of ranges) {
			const cylMin = r.cylinderMin ? parseFloat(r.cylinderMin) : undefined;
			const cylMax = r.cylinderMax ? parseFloat(r.cylinderMax) : undefined;
			const addMin = r.additionMin ? parseFloat(r.additionMin) : undefined;
			const addMax = r.additionMax ? parseFloat(r.additionMax) : undefined;

			const base = {
				...(cylMin !== undefined && !isNaN(cylMin) && { cylinderMin: cylMin }),
				...(cylMax !== undefined && !isNaN(cylMax) && { cylinderMax: cylMax }),
				...(addMin !== undefined && !isNaN(addMin) && { additionMin: addMin }),
				...(addMax !== undefined && !isNaN(addMax) && { additionMax: addMax })
			};

			if (r.symmetric) {
				const absMin = parseFloat(r.absMin) || 0;
				const absMax = parseFloat(r.absMax) || 0;

				if (absMin === 0) {
					// Continuous range: -absMax to +absMax (includes 0)
					result.push({ sphereMin: -absMax, sphereMax: absMax, ...base });
				} else {
					// Two sub-ranges: negative and positive sides
					result.push({ sphereMin: -absMax, sphereMax: -absMin, ...base });
					result.push({ sphereMin: absMin, sphereMax: absMax, ...base });
				}
			} else {
				const sphMin = parseFloat(r.sphereMin) || 0;
				const sphMax = parseFloat(r.sphereMax) || 0;
				result.push({ sphereMin: sphMin, sphereMax: sphMax, ...base });
			}
		}
		return result;
	}

	/** Serialized ranges for the hidden input */
	const serializedRanges = $derived(JSON.stringify(expandRanges()));

	/** Human-readable preview of what a range entry will generate */
	function rangePreview(r: RangeEntry): string[] {
		const fmt = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
		const lines: string[] = [];

		// Build sphere descriptions
		if (r.symmetric) {
			const absMin = parseFloat(r.absMin) || 0;
			const absMax = parseFloat(r.absMax) || 0;

			const cylMin = r.cylinderMin ? parseFloat(r.cylinderMin) : null;
			const cylMax = r.cylinderMax ? parseFloat(r.cylinderMax) : null;
			const addMin = r.additionMin ? parseFloat(r.additionMin) : null;
			const addMax = r.additionMax ? parseFloat(r.additionMax) : null;

			const cylPart =
				cylMin !== null && cylMax !== null && !isNaN(cylMin) && !isNaN(cylMax)
					? ` · Cil ${fmt(cylMin)} a ${fmt(cylMax)}`
					: '';
			const addPart =
				addMin !== null && addMax !== null && !isNaN(addMin) && !isNaN(addMax)
					? ` · Add ${fmt(addMin)} a ${fmt(addMax)}`
					: '';

			if (absMin === 0) {
				lines.push(`Esf ${fmt(-absMax)} a ${fmt(absMax)}${cylPart}${addPart}`);
			} else {
				lines.push(`Esf ${fmt(-absMax)} a ${fmt(-absMin)}${cylPart}${addPart}`);
				lines.push(`Esf ${fmt(absMin)} a ${fmt(absMax)}${cylPart}${addPart}`);
			}
		} else {
			const sMin = parseFloat(r.sphereMin) || 0;
			const sMax = parseFloat(r.sphereMax) || 0;

			const cylMin = r.cylinderMin ? parseFloat(r.cylinderMin) : null;
			const cylMax = r.cylinderMax ? parseFloat(r.cylinderMax) : null;
			const addMin = r.additionMin ? parseFloat(r.additionMin) : null;
			const addMax = r.additionMax ? parseFloat(r.additionMax) : null;

			const cylPart =
				cylMin !== null && cylMax !== null && !isNaN(cylMin) && !isNaN(cylMax)
					? ` · Cil ${fmt(cylMin)} a ${fmt(cylMax)}`
					: '';
			const addPart =
				addMin !== null && addMax !== null && !isNaN(addMin) && !isNaN(addMax)
					? ` · Add ${fmt(addMin)} a ${fmt(addMax)}`
					: '';

			lines.push(`Esf ${fmt(sMin)} a ${fmt(sMax)}${cylPart}${addPart}`);
		}

		return lines;
	}

	// ── Pending entity handlers ──────────────────────────────────
	function handleCreatePendingSupplier(name: string): SelectOption {
		const pendingId = `pending_supplier_${generateUUID()}`;
		pendingSuppliers = [...pendingSuppliers, { pendingId, name }];
		return { id: pendingId, name, isPending: true };
	}

	function handleCreatePendingMaterial(name: string): SelectOption {
		const pendingId = `pending_material_${generateUUID()}`;
		pendingMaterials = [...pendingMaterials, { pendingId, name }];
		return { id: pendingId, name, isPending: true };
	}

	function getPendingName(pendingId: string): string | null {
		if (!pendingId.startsWith('pending_')) return null;
		const sup = pendingSuppliers.find((s) => s.pendingId === pendingId);
		if (sup) return sup.name;
		const mat = pendingMaterials.find((m) => m.pendingId === pendingId);
		if (mat) return mat.name;
		return null;
	}

	// Handle create result
	function handleCreateResult() {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}
		toast.success('Lente agregado al catálogo');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/lenses');
	}

	// Handle update result
	function handleUpdateResult() {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}
		toast.success('Lente actualizado');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/lenses');
	}
</script>

<div class="mx-auto max-w-4xl">
	{#if isEdit && item}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult();
				} catch (e) {
					console.error(e);
					toast.error(e instanceof Error ? e.message : 'Error actualizando lente');
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<input type="hidden" name="id" value={item.id} />
			{@render pendingHiddenInputs()}
			{@render formFields()}
			{@render formActions()}
		</form>
	{:else}
		<!-- CREATE FORM -->
		<form
			{...currentCreateForm.enhance(async ({ submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleCreateResult();
				} catch (e) {
					console.error(e);
					toast.error(e instanceof Error ? e.message : 'Error creando lente');
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			{@render pendingHiddenInputs()}
			{@render formFields()}
			{@render formActions()}
		</form>
	{/if}
</div>

{#snippet pendingHiddenInputs()}
	{#if formData.supplierId?.startsWith('pending_')}
		<input
			type="hidden"
			name="pendingSupplierName"
			value={getPendingName(formData.supplierId) ?? ''}
		/>
	{/if}
	{#if formData.materialId?.startsWith('pending_material_')}
		<input
			type="hidden"
			name="pendingMaterialName"
			value={getPendingName(formData.materialId) ?? ''}
		/>
		{#if formData.refractiveIndex}
			<input type="hidden" name="pendingMaterialRefractiveIndex" value={formData.refractiveIndex} />
		{/if}
	{/if}
{/snippet}

{#snippet formFields()}
	<!-- Source selector -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-slate-800">Origen del Cristal</h3>
		<div class="grid gap-4 md:grid-cols-2">
			<button
				type="button"
				class="rounded-lg border-2 p-4 text-left transition-all {formData.source ===
				LensCatalogSource.LAB
					? 'border-blue-500 bg-blue-50/50'
					: 'border-slate-200 hover:border-slate-300'}"
				onclick={() => (formData.source = LensCatalogSource.LAB)}
			>
				<p class="font-semibold text-slate-800">{LENS_SOURCE_LABELS.LAB}</p>
				<p class="text-sm text-slate-500">Cristal elaborado a medida en laboratorio</p>
			</button>
			<button
				type="button"
				class="rounded-lg border-2 p-4 text-left transition-all {formData.source ===
				LensCatalogSource.FINISHED
					? 'border-indigo-500 bg-indigo-50/50'
					: 'border-slate-200 hover:border-slate-300'}"
				onclick={() => (formData.source = LensCatalogSource.FINISHED)}
			>
				<p class="font-semibold text-slate-800">{LENS_SOURCE_LABELS.FINISHED}</p>
				<p class="text-sm text-slate-500">Cristal pre-fabricado con graduación lista</p>
			</button>
		</div>
		<input type="hidden" name="source" value={formData.source} />
	</div>

	<!-- Basic info -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-slate-800">Información Básica</h3>
		<div class="grid gap-4 md:grid-cols-2">
			<div>
				<div class="mb-2 flex items-center justify-between">
					<Label for="lc_name">Nombre *</Label>
					{#if !isEdit}
						<label class="flex items-center gap-1.5 text-xs text-slate-500">
							<input
								type="checkbox"
								bind:checked={autoNameEnabled}
								class="h-3.5 w-3.5 rounded border-slate-300"
							/>
							Auto-generar
						</label>
					{/if}
				</div>
				<Input
					id="lc_name"
					name="name"
					bind:value={formData.name}
					placeholder="Ej: Novak · CR39 · Monofocal"
					class="placeholder:text-slate-400"
					required
					disabled={autoNameEnabled}
				/>
				{#if activeForm.fields.name?.issues()}
					<p class="mt-1 text-xs text-red-500">{activeForm.fields.name.issues()}</p>
				{/if}
				{#if autoNameEnabled}
					<p class="mt-1 text-xs text-slate-400">
						Se genera automáticamente desde los campos seleccionados
					</p>
				{/if}
			</div>
			<div>
				<Label for="lc_brand" class="mb-2">Marca</Label>
				<Input
					id="lc_brand"
					name="brand"
					bind:value={formData.brand}
					placeholder="Ej: Transitions, Essilor"
					class="placeholder:text-slate-400"
				/>
			</div>
		</div>

		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<div>
				<Label for="lc_technology" class="mb-2">Tecnología</Label>
				<Input
					id="lc_technology"
					name="technology"
					bind:value={formData.technology}
					placeholder="Ej: Evo-S, Digital, FreeForm"
					class="placeholder:text-slate-400"
				/>
			</div>
			<div>
				<Label for="lc_type" class="mb-2">Tipo *</Label>
				<Select id="lc_type" name="type" bind:value={formData.type} required>
					{#each Object.values(LensType) as t (t)}
						<option value={t}>{LENS_TYPE_LABELS[t]}</option>
					{/each}
				</Select>
			</div>
		</div>
	</div>

	<!-- Supplier & Material -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-slate-800">Proveedor y Material</h3>
		<div class="grid gap-4 md:grid-cols-2">
			<CreatableSelect
				label="Proveedor *"
				name="supplierId"
				bind:value={formData.supplierId}
				options={supplierOptions}
				placeholder="Buscar proveedor..."
				required
				creatable
				onCreatePending={handleCreatePendingSupplier}
			/>
			<CreatableSelect
				label="Material *"
				name="materialId"
				bind:value={formData.materialId}
				options={materialOptions}
				placeholder="Buscar material..."
				required
				creatable
				onCreatePending={handleCreatePendingMaterial}
			/>
		</div>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<div>
				<Label for="lc_ri" class="mb-2">Índice de Refracción</Label>
				<Input
					id="lc_ri"
					name="refractiveIndex"
					bind:value={formData.refractiveIndex}
					type="number"
					step="0.01"
					min="1.49"
					max="2.0"
					placeholder="1.50"
					class="font-mono placeholder:text-slate-400"
				/>
				{#if formData.materialId?.startsWith('pending_material_') && formData.refractiveIndex}
					<p class="mt-1 text-xs text-blue-500">Se usará como índice para el nuevo material</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Optical ranges (dynamic) -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-semibold text-slate-800">Rangos Ópticos</h3>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
				onclick={addRange}
			>
				+ Agregar rango
			</button>
		</div>

		<input type="hidden" name="ranges" value={serializedRanges} />

		{#each ranges as range, i (i)}
			<div
				class="relative mb-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4 {ranges.length >
				1
					? 'pr-10'
					: ''}"
			>
				{#if ranges.length > 1}
					<button
						type="button"
						class="absolute top-2 right-2 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
						onclick={() => removeRange(i)}
						title="Eliminar rango"
					>
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}

				<div class="mb-1 text-xs font-medium text-slate-500 uppercase">Rango {i + 1}</div>

				<!-- Sphere with ± toggle -->
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<div class="mb-2 flex items-center gap-2">
							<Label>Esfera *</Label>
							<button
								type="button"
								class="rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors {range.symmetric
									? 'border-blue-300 bg-blue-50 text-blue-700'
									: 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'}"
								onclick={() => {
									range.symmetric = !range.symmetric;
									if (range.symmetric) {
										// Convert explicit to symmetric
										const sMin = Math.abs(parseFloat(range.sphereMin) || 0);
										const sMax = Math.abs(parseFloat(range.sphereMax) || 0);
										range.absMin = Math.min(sMin, sMax).toFixed(2);
										range.absMax = Math.max(sMin, sMax).toFixed(2);
									} else {
										// Convert symmetric to explicit
										// const absMin = parseFloat(range.absMin) || 0;
										const absMax = parseFloat(range.absMax) || 0;
										range.sphereMin = (-absMax).toFixed(2);
										range.sphereMax = absMax.toFixed(2);
									}
								}}
								title={range.symmetric
									? 'Modo ±: positivo y negativo'
									: 'Modo explícito: min a max'}
							>
								±
							</button>
						</div>

						{#if range.symmetric}
							<!-- Symmetric mode: ±absMin to ±absMax -->
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-blue-600">±</span>
								<Input
									bind:value={range.absMin}
									type="number"
									step="0.25"
									min="0"
									placeholder="Ej: 0.00"
									size="sm"
									class="font-mono placeholder:text-slate-400"
								/>
								<span class="text-slate-400">a</span>
								<span class="text-sm font-medium text-blue-600">±</span>
								<Input
									bind:value={range.absMax}
									type="number"
									step="0.25"
									min="0"
									placeholder="Ej: 6.00"
									size="sm"
									class="font-mono placeholder:text-slate-400"
								/>
							</div>
						{:else}
							<!-- Explicit mode: sphereMin to sphereMax -->
							<div class="flex items-center gap-2">
								<Input
									bind:value={range.sphereMin}
									type="number"
									step="0.25"
									placeholder="Ej: -6.00"
									size="sm"
									class="font-mono placeholder:text-slate-400"
								/>
								<span class="text-slate-400">a</span>
								<Input
									bind:value={range.sphereMax}
									type="number"
									step="0.25"
									placeholder="Ej: +6.00"
									size="sm"
									class="font-mono placeholder:text-slate-400"
								/>
							</div>
						{/if}
					</div>

					<div>
						<Label class="mb-2">Cilindro</Label>
						<div class="flex items-center gap-2">
							<Input
								bind:value={range.cylinderMin}
								type="number"
								step="0.25"
								max="0"
								placeholder="Ej: -4.00"
								size="sm"
								class="font-mono placeholder:text-slate-400"
							/>
							<span class="text-slate-400">a</span>
							<Input
								bind:value={range.cylinderMax}
								type="number"
								step="0.25"
								max="0"
								placeholder="Ej: 0.00"
								size="sm"
								class="font-mono placeholder:text-slate-400"
							/>
						</div>
					</div>
				</div>

				{#if showAddition}
					<div class="mt-3">
						<Label class="mb-2">Adición</Label>
						<div class="flex items-center gap-2" style="max-width: 50%;">
							<Input
								bind:value={range.additionMin}
								type="number"
								step="0.25"
								min="0"
								max="4.00"
								placeholder="Ej: 0.75"
								size="sm"
								class="font-mono placeholder:text-slate-400"
							/>
							<span class="text-slate-400">a</span>
							<Input
								bind:value={range.additionMax}
								type="number"
								step="0.25"
								min="0"
								max="4.00"
								placeholder="Ej: 3.50"
								size="sm"
								class="font-mono placeholder:text-slate-400"
							/>
						</div>
					</div>
				{/if}

				<!-- Unified range preview -->
				<div class="mt-3 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
					<p class="mb-0.5 text-[10px] font-semibold tracking-wide text-blue-400 uppercase">
						Resultado
					</p>
					{#each rangePreview(range) as line, li (li)}
						<p class="font-mono text-xs leading-relaxed text-blue-700">
							{#if rangePreview(range).length > 1}
								<span class="mr-1 text-blue-400">{li + 1}.</span>
							{/if}
							{line}
						</p>
					{/each}
				</div>
			</div>
		{/each}

		{#if activeForm.fields.ranges?.issues()}
			<p class="mt-1 text-xs text-red-500">{activeForm.fields.ranges.issues()}</p>
		{/if}
	</div>

	<!-- Price, Delivery, Stock -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-slate-800">Precio y Disponibilidad</h3>
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
			<div>
				<Label for="lc_price" class="mb-2">Precio Compra ($) *</Label>
				<Input
					id="lc_price"
					name="basePrice"
					bind:value={formData.basePrice}
					type="number"
					step="0.01"
					min="0"
					class="font-mono"
					required
				/>
			</div>
			<div>
				<Label for="lc_sale_price" class="mb-2">Precio Venta ($)</Label>
				<Input
					id="lc_sale_price"
					name="salePrice"
					bind:value={formData.salePrice}
					type="number"
					step="0.01"
					min="0"
					placeholder="0.00"
					class="font-mono placeholder:text-slate-400"
				/>
			</div>
			<div>
				<Label for="lc_mounting_price" class="mb-2">Precio Montaje ($)</Label>
				<Input
					id="lc_mounting_price"
					name="mountingPrice"
					bind:value={formData.mountingPrice}
					type="number"
					step="0.01"
					min="0"
					placeholder="0.00"
					class="font-mono placeholder:text-slate-400"
				/>
			</div>
			<div>
				<Label for="lc_delivery" class="mb-2">Días de entrega</Label>
				<Input
					id="lc_delivery"
					name="deliveryDays"
					bind:value={formData.deliveryDays}
					type="number"
					min="0"
					placeholder="3"
					class="font-mono placeholder:text-slate-400"
				/>
			</div>
			<div>
				<Label for="lc_stock" class="mb-2">
					Stock
					{#if isFinished}
						<span class="ml-1 text-xs text-indigo-600">(Terminado)</span>
					{/if}
				</Label>
				<Input
					id="lc_stock"
					name="stock"
					bind:value={formData.stock}
					type="number"
					min="0"
					placeholder="0"
					class={{
						'font-mono placeholder:text-slate-400': true,
						'border-indigo-300 ring-1 ring-indigo-200': isFinished
					}}
				/>
				{#if isFinished}
					<p class="mt-1 text-xs text-indigo-500">Los cristales terminados se manejan por stock</p>
				{/if}
			</div>
		</div>

		<div class="mt-4">
			<Label class="mb-2 text-sm text-slate-600">Características incluidas</Label>
			<div class="flex flex-wrap items-center gap-6">
				<Checkbox name="isPhotochromic" bind:checked={formData.isPhotochromic}>
					Fotocromático
				</Checkbox>
				<Checkbox name="isBlueCut" bind:checked={formData.isBlueCut}>
					Blue Cut (Blue Block)
				</Checkbox>
				<Checkbox name="isAR" bind:checked={formData.isAR}>Antirreflejo (AR)</Checkbox>
			</div>
			<p class="mt-2 text-xs text-slate-400">
				Marca las características que ya vienen incluidas en este cristal
			</p>
		</div>
	</div>

	<!-- Notes -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-4 text-lg font-semibold text-slate-800">Notas</h3>
		<Textarea
			id="lc_notes"
			name="notes"
			bind:value={formData.notes}
			rows={3}
			placeholder="Notas adicionales sobre este cristal..."
		/>
	</div>
{/snippet}

{#snippet formActions()}
	<div class="flex justify-end gap-3 pb-8">
		<Button color="alternative" href={cancelHref} disabled={isSubmitting}>Cancelar</Button>
		<Button type="submit" color="blue" disabled={isSubmitting}>
			{#if isSubmitting}
				<span
					class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
				></span>
			{/if}
			{isEdit ? 'Actualizar' : 'Agregar al Catálogo'}
		</Button>
	</div>
{/snippet}
