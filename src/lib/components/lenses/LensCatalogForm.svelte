<script lang="ts">
	import { Label, Input, Select, Checkbox, Textarea, Popover } from 'flowbite-svelte';
	import { Info } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createLensCatalogItemForm, updateLensCatalogItemForm } from '$lib/remote/lenses.remote';
	import {
		CreatableSelect,
		TaxToggle,
		type SelectOption,
		type PendingEntity
	} from '$lib/components/ui';
	import FormActions from '$lib/components/ui/FormActions.svelte';
	import {
		LensType,
		LensCatalogSource,
		LensPriceType,
		LensInventoryMode,
		LENS_SOURCE_LABELS,
		ALL_LENS_TYPES,
		getLensTypeLabel,
		getPriceTypeLabel
	} from '$lib/shared/enums';
	import { scrollToFirstError, toastUnboundErrors, getFormErrorMessage } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import type { LensCatalogItem, LensOpticalRange } from '$lib/server/db/schema';
	import { resolve } from '$app/paths';

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

	type ExpandedRange = {
		sphereMin: number;
		sphereMax: number;
		cylinderMin?: number;
		cylinderMax?: number;
		additionMin?: number;
		additionMax?: number;
	};

	type Props = {
		item?: LensCatalogItem | null;
		existingRanges?: LensOpticalRange[];
		materials: { id: string; name: string }[];
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

	// Capture initial values (item comes from PageServerLoad, doesn't change)
	const initialItem = untrack(() => item);
	const initialRanges = untrack(() => existingRanges);

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
		source: (initialItem?.source as LensCatalogSource) ?? LensCatalogSource.LAB,
		supplierId: initialItem?.supplierId ?? '',
		name: initialItem?.name ?? '',
		type: (initialItem?.type as LensType) ?? LensType.MONOFOCAL,
		technology: initialItem?.technology ?? '',
		materialId: initialItem?.materialId ?? '',
		// Inherent traits
		hasAr: initialItem?.hasAr ?? false,
		hasBluecut: initialItem?.hasBluecut ?? false,
		isPhotochromic: initialItem?.isPhotochromic ?? false,
		// Pricing
		priceType: (initialItem?.priceType as LensPriceType) ?? LensPriceType.UNIT,
		basePrice: initialItem?.basePrice?.toString() ?? '0',
		salePrice: initialItem?.salePrice?.toString() ?? '',
		mountingPrice: initialItem?.mountingPrice?.toString() ?? '0',
		shippingPrice: initialItem?.shippingPrice?.toString() ?? '0',
		// Tax
		isTaxable: initialItem?.isTaxable ?? false,
		taxRate: initialItem?.taxRate?.toString() ?? '16',
		// Inventory
		inventoryMode: (initialItem?.inventoryMode as LensInventoryMode) ?? LensInventoryMode.ON_DEMAND,
		stock: initialItem?.stock != null ? initialItem.stock.toString() : '0',
		notes: initialItem?.notes ?? ''
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

	let ranges = $state<RangeEntry[]>(
		initialRanges.length > 0 ? collapseSymmetricRanges(initialRanges) : []
	);

	// Start with one empty range for FINISHED lenses (new items only)
	$effect(() => {
		if (ranges.length === 0 && !item) {
			untrack(() => {
				if (formData.source === LensCatalogSource.FINISHED) {
					ranges = [createEmptyRange()];
				}
			});
		}
	});

	// Force ON_DEMAND when source is LAB
	$effect(() => {
		if (formData.source === LensCatalogSource.LAB) {
			untrack(() => {
				formData.inventoryMode = LensInventoryMode.ON_DEMAND;
			});
		}
	});

	const showAddition = $derived(
		formData.type === LensType.PROGRESSIVE ||
			formData.type === LensType.BIFOCAL ||
			formData.type === LensType.OCCUPATIONAL
	);

	// Material/supplier options for CreatableSelect
	const materialOptions = $derived<SelectOption[]>(
		materials.map((m) => ({
			id: m.id,
			name: m.name
		}))
	);

	const supplierOptions = $derived<SelectOption[]>(
		suppliers.map((s) => ({ id: s.id, name: s.name }))
	);

	// Auto-name generation
	let autoNameEnabled = $state(!initialItem); // Auto-name only for new items

	const autoGeneratedName = $derived.by(() => {
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

		// Technology (optional)
		if (formData.technology.trim()) parts.push(formData.technology.trim());

		// Type
		const typeLabel = getLensTypeLabel(formData.type);
		if (typeLabel) parts.push(typeLabel);

		return parts.join(' · ');
	});

	// Apply auto-name when deps change
	$effect(() => {
		const name = autoGeneratedName;
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
		ranges = ranges.filter((_, i) => i !== index);
	}

	/** Convert a single DB range to a non-symmetric RangeEntry */
	function toPlainEntry(r: LensOpticalRange): RangeEntry {
		return {
			symmetric: false,
			absMin: '0.00',
			absMax: '0.00',
			sphereMin: r.sphereMin.toFixed(2),
			sphereMax: r.sphereMax.toFixed(2),
			cylinderMin: r.cylinderMin != null ? r.cylinderMin.toFixed(2) : '',
			cylinderMax: r.cylinderMax != null ? r.cylinderMax.toFixed(2) : '',
			additionMin: r.additionMin != null ? r.additionMin.toFixed(2) : '',
			additionMax: r.additionMax != null ? r.additionMax.toFixed(2) : ''
		};
	}

	/**
	 * Collapse DB rows back into UI RangeEntry items.
	 * Each DB row maps to one plain (non-symmetric) entry.
	 */
	function collapseSymmetricRanges(dbRanges: LensOpticalRange[]): RangeEntry[] {
		return dbRanges.map(toPlainEntry);
	}

	/**
	 * Expand UI range entries into flat DB range objects.
	 * When symmetric (±) is ON:
	 *   - If absMin is 0: one continuous range from -absMax to +absMax
	 *   - Otherwise: two ranges (negative side and positive side)
	 */
	function expandRanges(): ExpandedRange[] {
		const result: ExpandedRange[] = [];

		for (const r of ranges) {
			const cylA = r.cylinderMin ? parseFloat(r.cylinderMin) : undefined;
			const cylB = r.cylinderMax ? parseFloat(r.cylinderMax) : undefined;
			const addA = r.additionMin ? parseFloat(r.additionMin) : undefined;
			const addB = r.additionMax ? parseFloat(r.additionMax) : undefined;

			// Normalize min ≤ max ordering
			const hasCyl = cylA !== undefined && !isNaN(cylA) && cylB !== undefined && !isNaN(cylB);
			const hasAdd = addA !== undefined && !isNaN(addA) && addB !== undefined && !isNaN(addB);

			const base = {
				...(hasCyl && { cylinderMin: Math.min(cylA, cylB), cylinderMax: Math.max(cylA, cylB) }),
				...(hasAdd && { additionMin: Math.min(addA, addB), additionMax: Math.max(addA, addB) })
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

		// Deduplicate exact-same ranges (keep first occurrence)
		const seen = new SvelteSet<string>();
		return result.filter((r) => {
			const key = [
				r.sphereMin,
				r.sphereMax,
				r.cylinderMin,
				r.cylinderMax,
				r.additionMin,
				r.additionMax
			].join('|');
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
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

	/** Validate a range entry and return error messages */
	function getRangeErrors(r: RangeEntry): string[] {
		const errors: string[] = [];
		if (r.symmetric) {
			const absMin = parseFloat(r.absMin) || 0;
			const absMax = parseFloat(r.absMax) || 0;
			if (absMin > absMax) errors.push('Esfera: el mínimo absoluto no puede ser mayor al máximo');
		} else {
			const sMin = parseFloat(r.sphereMin) || 0;
			const sMax = parseFloat(r.sphereMax) || 0;
			if (sMin > sMax) errors.push('Esfera: el mínimo no puede ser mayor al máximo');
		}
		const cylMin = r.cylinderMin ? parseFloat(r.cylinderMin) : null;
		const cylMax = r.cylinderMax ? parseFloat(r.cylinderMax) : null;
		if (cylMin !== null && cylMax !== null && !isNaN(cylMin) && !isNaN(cylMax) && cylMin > cylMax) {
			errors.push('Cilindro: el mínimo no puede ser mayor al máximo');
		}
		const addMin = r.additionMin ? parseFloat(r.additionMin) : null;
		const addMax = r.additionMax ? parseFloat(r.additionMax) : null;
		if (addMin !== null && addMax !== null && !isNaN(addMin) && !isNaN(addMax) && addMin > addMax) {
			errors.push('Adición: el mínimo no puede ser mayor al máximo');
		}
		return errors;
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
			toast.error('Por favor corrige los errores del formulario');
			scrollToFirstError();
			toastUnboundErrors(allIssues);
			return;
		}
		const result = currentCreateForm.result;
		toast.success('Lente agregado al catálogo');
		goto(resolve(result ? `/lenses/${result.id}` : '/lenses'));
	}

	// Handle update result
	function handleUpdateResult() {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toast.error('Por favor corrige los errores del formulario');
			scrollToFirstError();
			toastUnboundErrors(allIssues);
			return;
		}
		toast.success('Lente actualizado');
		goto(resolve(`/lenses/${item!.id}`));
	}
</script>

<div class="mx-auto max-w-4xl pb-24">
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
	{/if}
{/snippet}

{#snippet formFields()}
	<!-- Hidden inputs for all sections -->
	<input type="hidden" name="source" value={formData.source} />
	<input type="hidden" name="hasAr" value={String(formData.hasAr)} />
	<input type="hidden" name="hasBluecut" value={String(formData.hasBluecut)} />
	<input type="hidden" name="isPhotochromic" value={String(formData.isPhotochromic)} />
	<input type="hidden" name="priceType" value={formData.priceType} />
	<input type="hidden" name="ranges" value={serializedRanges} />

	<!-- ================================================================
	     1. IDENTIDAD
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-1 text-lg font-semibold text-slate-800">Identidad del Cristal</h3>
		<p class="mb-4 text-xs text-slate-400">
			Define qué es este cristal: origen, proveedor, material y características ópticas propias.
		</p>

		<!-- Source selector -->
		<div class="mb-5 grid gap-3 sm:grid-cols-2">
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

		<!-- Name -->
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
			{#if autoNameEnabled}
				<input type="hidden" name="name" value={formData.name} />
			{/if}
			<Input
				id="lc_name"
				name={autoNameEnabled ? undefined : 'name'}
				bind:value={formData.name}
				placeholder="Ej: Novak · CR39 · Monofocal"
				class="placeholder:text-slate-400"
				required
				disabled={autoNameEnabled}
			/>
			{#if activeForm.fields.name?.issues()}
				<p class="mt-1 text-xs text-red-500">
					{getFormErrorMessage(activeForm.fields.name.issues())}
				</p>
			{/if}
			{#if autoNameEnabled}
				<p class="mt-1 text-xs text-slate-400">
					Se genera automáticamente desde los campos seleccionados
				</p>
			{/if}
		</div>

		<!-- Supplier + Material -->
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<CreatableSelect
				label="Proveedor *"
				name="supplierId"
				bind:value={formData.supplierId}
				options={supplierOptions}
				placeholder="Buscar proveedor..."
				required
				creatable
				onCreatePending={handleCreatePendingSupplier}
				error={activeForm.fields.supplierId?.issues()
					? getFormErrorMessage(activeForm.fields.supplierId.issues())
					: null}
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
				error={activeForm.fields.materialId?.issues()
					? getFormErrorMessage(activeForm.fields.materialId.issues())
					: null}
			/>
		</div>

		<!-- Type -->
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<div>
				<Label for="lc_type" class="mb-2">Tipo *</Label>
				<Select id="lc_type" name="type" bind:value={formData.type} required class="max-w-xs">
					{#each ALL_LENS_TYPES as t (t)}
						<option value={t}>{getLensTypeLabel(t)}</option>
					{/each}
				</Select>
			</div>
			<div>
				<Label for="lc_technology" class="mb-2">
					Tecnología
					<span class="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
				</Label>
				<Input
					id="lc_technology"
					name="technology"
					bind:value={formData.technology}
					placeholder="Ej: Accuracy, Slim, Digital..."
					class="placeholder:text-slate-400"
				/>
			</div>
		</div>

		<!-- Inherent traits -->
		<div class="mt-5 border-t border-slate-100 pt-5">
			<p class="mb-3 text-sm font-medium text-slate-600">Rasgos inherentes</p>
			<div class="flex flex-wrap gap-6">
				<Checkbox bind:checked={formData.hasAr}>Antirreflejo (AR)</Checkbox>
				<Checkbox bind:checked={formData.hasBluecut}>Filtro azul (Bluecut)</Checkbox>
				<Checkbox bind:checked={formData.isPhotochromic}>Fotocromático</Checkbox>
			</div>
		</div>
	</div>

	<!-- ================================================================
	     2. PRECIOS Y DISPONIBILIDAD
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-1 text-lg font-semibold text-slate-800">Precios y Disponibilidad</h3>
		<p class="mb-4 text-xs text-slate-400">
			Precio de compra al proveedor, precio de venta sugerido y tipo de cobro.
		</p>

		<!-- Price type selector -->
		<div class="mb-5">
			<Label class="mb-2 text-sm text-slate-600">¿Cómo cobra el proveedor?</Label>
			<div class="grid gap-3 sm:grid-cols-2">
				<button
					type="button"
					class="rounded-lg border-2 p-3 text-left transition-all {formData.priceType ===
					LensPriceType.UNIT
						? 'border-blue-500 bg-blue-50/50'
						: 'border-slate-200 hover:border-slate-300'}"
					onclick={() => (formData.priceType = LensPriceType.UNIT)}
				>
					<p class="text-sm font-semibold text-slate-800">
						{getPriceTypeLabel(LensPriceType.UNIT)}
					</p>
					<p class="text-xs text-slate-500">El precio base es por un solo cristal</p>
				</button>
				<button
					type="button"
					class="rounded-lg border-2 p-3 text-left transition-all {formData.priceType ===
					LensPriceType.PAIR
						? 'border-indigo-500 bg-indigo-50/50'
						: 'border-slate-200 hover:border-slate-300'}"
					onclick={() => (formData.priceType = LensPriceType.PAIR)}
				>
					<p class="text-sm font-semibold text-slate-800">
						{getPriceTypeLabel(LensPriceType.PAIR)}
					</p>
					<p class="text-xs text-slate-500">El precio base incluye ambos cristales</p>
				</button>
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<Label for="lc_price" class="mb-2">
					Precio Compra ($) *
					<span class="ml-1 text-xs font-normal text-slate-400">
						({formData.priceType === LensPriceType.PAIR ? 'par' : 'unidad'})
					</span>
				</Label>
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
				<Label for="lc_sale_price" class="mb-2">
					Precio Venta ($)
					<span class="ml-1 text-xs font-normal text-slate-400">
						({formData.priceType === LensPriceType.PAIR ? 'par' : 'unidad'})
					</span>
				</Label>
				<Input
					id="lc_sale_price"
					name="salePrice"
					bind:value={formData.salePrice}
					type="number"
					step="0.01"
					min="0"
					placeholder="Ej: 35.00"
					class="font-mono placeholder:text-slate-400"
				/>
				<p class="mt-1 text-[11px] text-slate-400">Se usa como precio sugerido en ventas</p>
			</div>
			<div>
				<Label for="lc_mounting_price" class="mb-2">
					Montaje ($)
					<span class="ml-1 text-xs font-normal text-slate-400">(par)</span>
				</Label>
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
				<Label for="lc_shipping" class="mb-2">Envío ($)</Label>
				<Input
					id="lc_shipping"
					name="shippingPrice"
					bind:value={formData.shippingPrice}
					type="number"
					step="0.01"
					min="0"
					placeholder="0.00"
					class="font-mono placeholder:text-slate-400"
				/>
			</div>

			<!-- Tax (IVA) -->
			<div class="col-span-full">
				<TaxToggle bind:checked={formData.isTaxable} bind:taxRate={formData.taxRate} />
				<p class="mt-1 text-[11px] text-slate-400">Los cristales son exentos de IVA por defecto</p>
			</div>
			{#if formData.source === LensCatalogSource.FINISHED}
				<div>
					<Label class="mb-2">Modo de Inventario</Label>
					<input type="hidden" name="inventoryMode" value={formData.inventoryMode} />
					<div class="flex gap-2">
						<button
							type="button"
							class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {formData.inventoryMode ===
							LensInventoryMode.ON_DEMAND
								? 'border-sky-300 bg-sky-50 text-sky-700'
								: 'border-slate-200 text-slate-500 hover:bg-slate-50'}"
							onclick={() => (formData.inventoryMode = LensInventoryMode.ON_DEMAND)}
						>
							Por demanda
						</button>
						<button
							type="button"
							class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {formData.inventoryMode ===
							LensInventoryMode.STOCK
								? 'border-teal-300 bg-teal-50 text-teal-700'
								: 'border-slate-200 text-slate-500 hover:bg-slate-50'}"
							onclick={() => (formData.inventoryMode = LensInventoryMode.STOCK)}
						>
							En inventario
						</button>
					</div>
					{#if formData.inventoryMode === LensInventoryMode.ON_DEMAND}
						<p class="mt-1.5 flex items-center gap-1 text-xs text-sky-600">
							<span class="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true"
							></span>
							Se pide al proveedor cuando se vende
						</p>
					{/if}
				</div>
				{#if formData.inventoryMode === LensInventoryMode.STOCK}
					<div>
						<Label for="lc_stock" class="mb-2">Cantidad en Stock</Label>
						<Input
							id="lc_stock"
							name="stock"
							bind:value={formData.stock}
							type="number"
							min="0"
							placeholder="0"
							class="font-mono placeholder:text-slate-400"
						/>
						{#if Number(formData.stock) > 0}
							<p class="mt-1.5 flex items-center gap-1 text-xs text-teal-600">
								<span class="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true"
								></span>
								{formData.stock} unidad{Number(formData.stock) !== 1 ? 'es' : ''} en inventario
							</p>
						{:else}
							<p class="mt-1.5 flex items-center gap-1 text-xs text-red-500">
								<span class="inline-block h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true"
								></span>
								Sin stock
							</p>
						{/if}
					</div>
				{/if}
			{:else}
				<!-- LAB lenses are always on-demand -->
				<input type="hidden" name="inventoryMode" value={LensInventoryMode.ON_DEMAND} />
			{/if}
		</div>
	</div>

	<!-- ================================================================
	     3. RANGOS ÓPTICOS
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="mb-1 flex items-center justify-between">
			<div class="flex items-center gap-1.5">
				<h3 class="text-lg font-semibold text-slate-800">Rangos Ópticos</h3>
				<Info id="help-ranges" class="h-4 w-4 cursor-help text-slate-400" />
				<Popover triggeredBy="#help-ranges" class="w-72 text-sm" trigger="hover">
					<p class="mb-1 font-medium">¿Qué son los rangos?</p>
					<p>
						Definen qué graduaciones puede cubrir este cristal: esfera (miopía/hipermetropía),
						cilindro (astigmatismo) y adición (para progresivos/bifocales). Si el paciente cae fuera
						del rango, este cristal no le sirve.
					</p>
				</Popover>
			</div>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
				onclick={addRange}
			>
				+ Agregar rango
			</button>
		</div>
		<p class="mb-4 text-xs text-slate-400">
			{#if formData.source === LensCatalogSource.LAB}
				Opcional para cristales de laboratorio. Muchos proveedores no publican rangos específicos.
			{:else}
				Graduaciones que cubre este cristal. Usa ± para rangos simétricos (positivo y negativo).
			{/if}
		</p>

		{#if ranges.length === 0}
			<div class="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
				<p class="text-sm text-slate-500">
					{#if formData.source === LensCatalogSource.LAB}
						Sin rangos definidos — se consultará al proveedor por disponibilidad.
					{:else}
						Agrega al menos un rango óptico para este cristal terminado.
					{/if}
				</p>
				<button
					type="button"
					class="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
					onclick={addRange}
				>
					+ Agregar rango
				</button>
			</div>
		{/if}

		{#each ranges as range, i (i)}
			{@const rangeErrors = getRangeErrors(range)}
			<div
				class="relative mb-4 rounded-lg border bg-slate-50/50 p-4 pr-10 {rangeErrors.length > 0
					? 'border-red-300'
					: 'border-slate-200'}"
			>
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

				<!-- Inline validation errors -->
				{#if rangeErrors.length > 0}
					<div class="mt-2 space-y-1">
						{#each rangeErrors as err (err)}
							<p class="text-xs text-red-600">{err}</p>
						{/each}
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
			<p class="mt-1 text-xs text-red-500">
				{getFormErrorMessage(activeForm.fields.ranges.issues())}
			</p>
		{/if}
	</div>

	<!-- ================================================================
	     4. NOTAS
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-1 text-lg font-semibold text-slate-800">Notas</h3>
		<p class="mb-3 text-xs text-slate-400">
			Información interna: observaciones, restricciones, detalles del proveedor, etc.
		</p>
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
	<FormActions
		primaryLabel={isEdit ? 'Actualizar' : 'Agregar al Catálogo'}
		{cancelHref}
		{isSubmitting}
	/>
{/snippet}
