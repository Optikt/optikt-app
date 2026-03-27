<script lang="ts">
	import { Label, Input, Select, Checkbox, Textarea, Popover } from 'flowbite-svelte';
	import { Info } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { createLensCatalogItemForm, updateLensCatalogItemForm } from '$lib/remote/lenses.remote';
	import { getSupplierTreatmentDefaults } from '$lib/remote/suppliers.remote';
	import { CreatableSelect, type SelectOption, type PendingEntity } from '$lib/components/ui';
	import FormActions from '$lib/components/ui/FormActions.svelte';
	import {
		LensType,
		LensCatalogSource,
		LensPricingUnit,
		LENS_SOURCE_LABELS,
		LENS_PRICING_UNIT_LABELS,
		ALL_LENS_TYPES,
		getLensTypeLabel
	} from '$lib/shared/enums';
	import {
		PhotochromicMode,
		LensRangeAvailability,
		LensTreatmentAvailability,
		CORE_LENS_TREATMENT_CODES,
		PHOTOCHROMIC_MODE_LABELS,
		LENS_RANGE_AVAILABILITY_LABELS,
		LENS_TREATMENT_LABELS,
		LENS_TREATMENT_AVAILABILITY_LABELS,
		findTreatmentPolicy,
		createDefaultTreatmentPolicies,
		toTreatmentPolicy,
		type CoreLensTreatmentCode
	} from '$lib/shared/contracts';
	import { scrollToFirstError, getFormErrorMessage } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import type { LensCatalogItem, LensOpticalRange } from '$lib/server/db/schema';
	import type { LensTreatmentPolicy } from '$lib/shared/contracts';
	import { resolveTreatmentPolicies } from '$lib/shared/planning';
	import { resolve } from '$app/paths';

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

	type ExpandedRange = {
		sphereMin: number;
		sphereMax: number;
		cylinderMin?: number;
		cylinderMax?: number;
		additionMin?: number;
		additionMax?: number;
		mirrorGroup?: string;
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
		variant: '',
		technology: '',
		type: LensType.MONOFOCAL as LensType,
		materialId: '',
		// Identity traits
		photochromicMode: PhotochromicMode.NONE as PhotochromicMode,
		rangeAvailability: LensRangeAvailability.EXACT_RANGES as LensRangeAvailability,
		// Pricing
		pricingUnit: LensPricingUnit.UNIT as LensPricingUnit,
		basePrice: '0',
		suggestedMultiplier: '',
		// Purchase policy
		allowsSingleUnitOrder: false,
		singleUnitRequiresConfirmation: false,
		singleUnitSurcharge: '0',
		minimumOrderUnits: '1',
		mountingPrice: '0',
		shippingPrice: '0',
		// Operations
		deliveryDays: '',
		stock: '0',
		refractiveIndex: '',
		notes: ''
	});

	// Treatment policies — one per core treatment code
	let treatmentPolicies = $state<LensTreatmentPolicy[]>(createDefaultTreatmentPolicies());

	// Supplier treatment defaults + inheritance tracking
	let supplierDefaults = $state<LensTreatmentPolicy[]>([]);
	let overriddenCodes = new SvelteSet<CoreLensTreatmentCode>();

	const hasRealSupplier = $derived(
		!!formData.supplierId && !formData.supplierId.startsWith('pending_')
	);

	// Fetch supplier treatment defaults when supplier selection changes
	$effect(() => {
		const supplierId = formData.supplierId;
		if (supplierId && !supplierId.startsWith('pending_')) {
			untrack(() => {
				fetchSupplierDefaults(supplierId);
			});
		} else {
			untrack(() => {
				supplierDefaults = [];
				const overrides = treatmentPolicies.filter((p) => overriddenCodes.has(p.code));
				treatmentPolicies = resolveTreatmentPolicies([], overrides);
			});
		}
	});

	async function fetchSupplierDefaults(supplierId: string) {
		try {
			const rows = await getSupplierTreatmentDefaults({ supplierId });
			supplierDefaults = rows.map((row) =>
				toTreatmentPolicy(row.code as CoreLensTreatmentCode, {
					availability: row.availability as LensTreatmentAvailability,
					additionalPrice: row.additionalPrice,
					requiresConfirmation: row.requiresConfirmation
				})
			);
			const overrides = treatmentPolicies.filter((p) => overriddenCodes.has(p.code));
			treatmentPolicies = resolveTreatmentPolicies(supplierDefaults, overrides);
		} catch (e) {
			console.error(e);
			supplierDefaults = [];
		}
	}

	function toggleTreatmentOverride(code: CoreLensTreatmentCode) {
		if (overriddenCodes.has(code)) {
			// Revert to supplier default
			overriddenCodes.delete(code);
			const defaultPolicy = findTreatmentPolicy(supplierDefaults, code) ?? toTreatmentPolicy(code);
			const idx = treatmentPolicies.findIndex((p) => p.code === code);
			if (idx >= 0) treatmentPolicies[idx] = { ...defaultPolicy };
		} else {
			overriddenCodes.add(code);
		}
	}

	/** Only overridden policies are stored — non-overridden inherit from supplier */
	const serializedTreatmentOverrides = $derived(
		JSON.stringify(treatmentPolicies.filter((p) => overriddenCodes.has(p.code)))
	);

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
					variant: '',
					technology: item!.technology ?? '',
					type: item!.type as LensType,
					materialId: item!.materialId,
					photochromicMode: (item!.photochromicMode as PhotochromicMode) ?? PhotochromicMode.NONE,
					rangeAvailability:
						(item!.rangeAvailability as LensRangeAvailability) ??
						LensRangeAvailability.EXACT_RANGES,
					pricingUnit: (item!.pricingUnit as LensPricingUnit) ?? LensPricingUnit.UNIT,
					basePrice: item!.basePrice.toString(),
					suggestedMultiplier: item!.suggestedMultiplier?.toString() ?? '',
					allowsSingleUnitOrder: item!.allowsSingleUnitOrder,
					singleUnitRequiresConfirmation: item!.singleUnitRequiresConfirmation,
					singleUnitSurcharge: item!.singleUnitSurcharge.toString(),
					minimumOrderUnits: item!.minimumOrderUnits.toString(),
					mountingPrice: item!.mountingPrice.toString(),
					shippingPrice: item!.shippingPrice.toString(),
					deliveryDays: item!.deliveryDays?.toString() ?? '',
					stock: item!.stock?.toString() ?? '0',
					refractiveIndex: item!.refractiveIndex?.toString() ?? '',
					notes: item!.notes ?? ''
				};

				// Load existing treatment policies or create defaults
				const existing = item!.treatmentPolicies;
				if (existing && existing.length > 0) {
					// Stored policies are treated as overrides (explicit per-item values)
					overriddenCodes.clear();
					for (const p of existing) overriddenCodes.add(p.code as CoreLensTreatmentCode);
					treatmentPolicies = CORE_LENS_TREATMENT_CODES.map((code) => {
						const found = findTreatmentPolicy(existing, code);
						return found ?? toTreatmentPolicy(code);
					});
				} else {
					overriddenCodes.clear();
					treatmentPolicies = createDefaultTreatmentPolicies();
				}

				// Load existing ranges — try to detect symmetric (±) mirror pairs
				if (existingRanges.length > 0) {
					ranges = collapseSymmetricRanges(existingRanges);
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
	let autoNameEnabled = $state(untrack(() => !item)); // Auto-name only for new items

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

		// Variant (optional differentiator)
		if (formData.variant) parts.push(formData.variant);

		// Type
		const typeLabel = getLensTypeLabel(formData.type);
		if (typeLabel) parts.push(typeLabel);

		// Technology
		if (formData.technology) parts.push(formData.technology);

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
		if (ranges.length <= 1) return;
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
	 * Rows sharing the same mirrorGroup UUID are a symmetric (±) pair/single.
	 * Rows without mirrorGroup are loaded as normal asymmetric ranges.
	 */
	function collapseSymmetricRanges(dbRanges: LensOpticalRange[]): RangeEntry[] {
		const result: RangeEntry[] = [];

		// Group by mirrorGroup — null-mirrorGroup rows are standalone
		const groups = new SvelteMap<string, LensOpticalRange[]>();
		const standalone: LensOpticalRange[] = [];

		for (const r of dbRanges) {
			if (r.mirrorGroup) {
				const group = groups.get(r.mirrorGroup) ?? [];
				group.push(r);
				groups.set(r.mirrorGroup, group);
			} else {
				standalone.push(r);
			}
		}

		// Process mirror groups → symmetric entries
		for (const [, rows] of groups) {
			if (rows.length === 1) {
				// Single row with mirrorGroup = continuous symmetric (absMin=0, e.g. -6 to +6)
				const r = rows[0];
				result.push({
					symmetric: true,
					absMin: '0.00',
					absMax: Math.max(Math.abs(r.sphereMin), Math.abs(r.sphereMax)).toFixed(2),
					sphereMin: r.sphereMin.toFixed(2),
					sphereMax: r.sphereMax.toFixed(2),
					cylinderMin: r.cylinderMin != null ? r.cylinderMin.toFixed(2) : '',
					cylinderMax: r.cylinderMax != null ? r.cylinderMax.toFixed(2) : '',
					additionMin: r.additionMin != null ? r.additionMin.toFixed(2) : '',
					additionMax: r.additionMax != null ? r.additionMax.toFixed(2) : ''
				});
			} else {
				// Two rows = mirror pair → find the positive side for absMin/absMax
				const pos = rows.find((r) => r.sphereMin >= 0) ?? rows[0];
				const neg = rows.find((r) => r.sphereMax <= 0) ?? rows[1];
				result.push({
					symmetric: true,
					absMin: Math.abs(pos.sphereMin).toFixed(2),
					absMax: Math.abs(pos.sphereMax).toFixed(2),
					sphereMin: neg.sphereMin.toFixed(2),
					sphereMax: pos.sphereMax.toFixed(2),
					cylinderMin: pos.cylinderMin != null ? pos.cylinderMin.toFixed(2) : '',
					cylinderMax: pos.cylinderMax != null ? pos.cylinderMax.toFixed(2) : '',
					additionMin: pos.additionMin != null ? pos.additionMin.toFixed(2) : '',
					additionMax: pos.additionMax != null ? pos.additionMax.toFixed(2) : ''
				});
			}
		}

		// Standalone rows → plain entries
		for (const r of standalone) {
			result.push(toPlainEntry(r));
		}

		return result;
	}

	/**
	 * Expand UI range entries into flat DB range objects.
	 * When symmetric (±) is ON:
	 *   - If absMin is 0: one continuous range from -absMax to +absMax
	 *   - Otherwise: two ranges (negative side and positive side)
	 * Symmetric pairs share a mirrorGroup UUID so they can be
	 * re-collapsed when editing later.
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
				const mirrorGroup = generateUUID();

				if (absMin === 0) {
					// Continuous range: -absMax to +absMax (includes 0)
					result.push({ sphereMin: -absMax, sphereMax: absMax, ...base, mirrorGroup });
				} else {
					// Two sub-ranges: negative and positive sides — same mirrorGroup
					result.push({ sphereMin: -absMax, sphereMax: -absMin, ...base, mirrorGroup });
					result.push({ sphereMin: absMin, sphereMax: absMax, ...base, mirrorGroup });
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
		{#if formData.refractiveIndex}
			<input type="hidden" name="pendingMaterialRefractiveIndex" value={formData.refractiveIndex} />
		{/if}
	{/if}
{/snippet}

{#snippet formFields()}
	<!-- Hidden inputs for all sections -->
	<input type="hidden" name="source" value={formData.source} />
	<input type="hidden" name="pricingUnit" value={formData.pricingUnit} />
	<input type="hidden" name="photochromicMode" value={formData.photochromicMode} />
	<input type="hidden" name="rangeAvailability" value={formData.rangeAvailability} />
	<input type="hidden" name="treatmentPolicies" value={serializedTreatmentOverrides} />
	<input
		type="hidden"
		name="allowsSingleUnitOrder"
		value={String(formData.allowsSingleUnitOrder)}
	/>
	<input
		type="hidden"
		name="singleUnitRequiresConfirmation"
		value={String(formData.singleUnitRequiresConfirmation)}
	/>
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

		<!-- Name + Variant -->
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
			<div>
				<Label for="lc_variant" class="mb-2">
					Variante
					<span class="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
				</Label>
				<Input
					id="lc_variant"
					bind:value={formData.variant}
					placeholder="Ej: Altos, Premium, Económico"
					class="placeholder:text-slate-400"
				/>
				<p class="mt-1 text-xs text-slate-400">
					Para diferenciar materiales similares con distintos precios/rangos
				</p>
			</div>
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

		<!-- Type + Brand + Technology + RI -->
		<div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<Label for="lc_type" class="mb-2">Tipo *</Label>
				<Select id="lc_type" name="type" bind:value={formData.type} required>
					{#each ALL_LENS_TYPES as t (t)}
						<option value={t}>{getLensTypeLabel(t)}</option>
					{/each}
				</Select>
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

		<!-- Photochromic + Range availability (rasgos inherentes) -->
		<div class="mt-5 border-t border-slate-100 pt-5">
			<p class="mb-3 text-sm font-medium text-slate-600">Rasgos inherentes</p>

			<div class="mb-4">
				<div class="mb-2 flex items-center gap-1.5">
					<Label class="text-sm text-slate-600">Fotocromático</Label>
					<Info id="help-photochromic" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-photochromic" class="w-48 text-sm" trigger="hover">
						Indica si el cristal es o no fotocromático.
					</Popover>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each Object.values(PhotochromicMode) as mode (mode)}
						<button
							type="button"
							class="rounded-lg border-2 p-3 text-left transition-all {formData.photochromicMode ===
							mode
								? 'border-amber-500 bg-amber-50/50'
								: 'border-slate-200 hover:border-slate-300'}"
							onclick={() => (formData.photochromicMode = mode)}
						>
							<p class="text-sm font-semibold text-slate-800">
								{PHOTOCHROMIC_MODE_LABELS[mode]}
							</p>
							<p class="mt-0.5 text-xs text-slate-500">
								{mode === PhotochromicMode.INHERENT
									? 'El cristal cambia de color con la luz — viene de fábrica'
									: 'Cristal transparente, sin propiedad fotocromática'}
							</p>
						</button>
					{/each}
				</div>
			</div>

			<div>
				<div class="mb-2 flex items-center gap-1.5">
					<Label class="text-sm text-slate-600">Disponibilidad de rangos</Label>
					<Info id="help-range-avail" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-range-avail" class="w-64 text-sm" trigger="hover">
						Algunos proveedores publican rangos exactos de esfera/cilindro. Otros requieren consulta
						para saber si pueden fabricar una graduación específica.
					</Popover>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each Object.values(LensRangeAvailability) as ra (ra)}
						<button
							type="button"
							class="rounded-lg border-2 p-3 text-left transition-all {formData.rangeAvailability ===
							ra
								? 'border-blue-500 bg-blue-50/50'
								: 'border-slate-200 hover:border-slate-300'}"
							onclick={() => (formData.rangeAvailability = ra)}
						>
							<p class="text-sm font-semibold text-slate-800">
								{LENS_RANGE_AVAILABILITY_LABELS[ra]}
							</p>
							<p class="mt-0.5 text-xs text-slate-500">
								{ra === LensRangeAvailability.EXACT_RANGES
									? 'El proveedor publica rangos exactos'
									: 'Requiere consulta al proveedor'}
							</p>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- ================================================================
	     2. POLÍTICAS DE TRATAMIENTO
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="mb-4">
			<div class="flex items-center gap-1.5">
				<h3 class="text-lg font-semibold text-slate-800">Políticas de Tratamiento</h3>
				<Info id="help-treatment-policies" class="h-4 w-4 cursor-help text-slate-400" />
				<Popover triggeredBy="#help-treatment-policies" class="w-80 text-sm" trigger="hover">
					<p class="mb-2">
						Cada proveedor define qué tratamientos ofrece (antirreflejo, filtro azul, etc.) y a qué
						costo. Al seleccionar un proveedor, este cristal hereda esa configuración
						automáticamente.
					</p>
					<p class="mb-2">
						Si un cristal específico necesita algo diferente, puedes hacer click en
						<strong>"Personalizar"</strong> para sobrescribir la política del proveedor solo para
						este ítem. Click en <strong>"Heredar"</strong> para volver al valor del proveedor.
					</p>
					<p class="text-xs text-slate-400">
						Opciones: <strong>Inherente</strong> (ya incluido),
						<strong>Extra opcional</strong> (costo adicional),
						<strong>No disponible</strong>.
					</p>
				</Popover>
			</div>
			<p class="mt-1 text-xs text-slate-400">
				{#if hasRealSupplier}
					Hereda la configuración del proveedor. Puedes personalizar por cristal si es diferente.
				{:else}
					Define qué tratamientos están disponibles y a qué costo para este cristal.
				{/if}
			</p>
		</div>
		<div class="space-y-3">
			{#each treatmentPolicies as policy, pi (policy.code)}
				{@const isOverridden = overriddenCodes.has(policy.code)}
				{@const isInherited = hasRealSupplier && !isOverridden}
				<div
					class="rounded-lg border p-4 {isInherited
						? 'border-slate-150 bg-slate-50/30'
						: 'border-slate-200 bg-slate-50/50'}"
				>
					<div class="mb-2 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold text-slate-700">
								{LENS_TREATMENT_LABELS[policy.code as CoreLensTreatmentCode] ?? policy.code}
							</span>
							{#if hasRealSupplier}
								{#if isOverridden}
									<span
										class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
									>
										Personalizado
									</span>
								{:else}
									<span
										class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
									>
										Heredado del proveedor
									</span>
								{/if}
							{/if}
						</div>
						{#if hasRealSupplier}
							<button
								type="button"
								class="text-xs text-slate-400 transition-colors hover:text-slate-600"
								onclick={() => toggleTreatmentOverride(policy.code)}
							>
								{isOverridden ? 'Heredar' : 'Personalizar'}
							</button>
						{/if}
					</div>

					{#if isInherited}
						<!-- Read-only inherited view -->
						<p class="text-sm text-slate-500">
							{LENS_TREATMENT_AVAILABILITY_LABELS[policy.availability]}
							{#if policy.availability === LensTreatmentAvailability.OPTIONAL_EXTRA}
								<span class="font-mono">· ${policy.additionalPrice}</span>
								{#if policy.requiresConfirmation}
									<span>· Requiere confirmación</span>
								{/if}
							{/if}
						</p>
					{:else}
						<!-- Editable controls -->
						<div class="grid gap-3 sm:grid-cols-3">
							{#each Object.values(LensTreatmentAvailability) as avail (avail)}
								<button
									type="button"
									class="rounded-md border-2 px-3 py-2 text-left text-xs transition-all {policy.availability ===
									avail
										? 'border-blue-500 bg-blue-50'
										: 'border-slate-200 hover:border-slate-300'}"
									onclick={() => {
										treatmentPolicies[pi].availability = avail;
										if (hasRealSupplier) overriddenCodes.add(policy.code);
									}}
								>
									<span class="font-medium">{LENS_TREATMENT_AVAILABILITY_LABELS[avail]}</span>
									<span class="mt-0.5 block text-[10px] text-slate-400">
										{avail === LensTreatmentAvailability.INHERENT
											? 'Ya viene incluido'
											: avail === LensTreatmentAvailability.OPTIONAL_EXTRA
												? 'Se puede agregar'
												: 'No se ofrece'}
									</span>
								</button>
							{/each}
						</div>
						{#if policy.availability === LensTreatmentAvailability.OPTIONAL_EXTRA}
							<div class="mt-3 grid gap-3 sm:grid-cols-2">
								<div>
									<Label class="mb-1 text-xs text-slate-500">Precio adicional ($)</Label>
									<Input
										bind:value={treatmentPolicies[pi].additionalPrice}
										type="number"
										step="0.1"
										min="0"
										size="sm"
										class="font-mono"
									/>
									{#if policy.additionalPrice === 0}
										<p class="mt-1 text-xs text-amber-600">
											Precio en $0 — ¿el tratamiento es gratuito?
										</p>
									{/if}
								</div>
								<div class="flex items-end">
									<Checkbox bind:checked={treatmentPolicies[pi].requiresConfirmation}>
										<span class="text-xs text-slate-600">Requiere confirmación</span>
									</Checkbox>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
		<p class="mt-2 text-xs text-slate-400">
			{#if hasRealSupplier}
				Los valores heredados cambian automáticamente si se actualizan en el proveedor
			{:else}
				Define cómo se comporta cada tratamiento para este cristal
			{/if}
		</p>
	</div>

	<!-- ================================================================
	     3. POLÍTICA DE COMPRA
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="mb-4">
			<div class="flex items-center gap-1.5">
				<h3 class="text-lg font-semibold text-slate-800">Política de Compra</h3>
				<Info id="help-purchase-policy" class="h-4 w-4 cursor-help text-slate-400" />
				<Popover triggeredBy="#help-purchase-policy" class="w-72 text-sm" trigger="hover">
					Condiciones comerciales del proveedor para este cristal: cómo se cobra (por unidad o par),
					mínimos de pedido, recargos por comprar un solo cristal, y costos de montaje/envío. Estos
					datos se usan para calcular costos en la venta.
				</Popover>
			</div>
			<p class="mt-1 text-xs text-slate-400">
				Cómo negocias con el proveedor: unidad de precio, mínimos y cargos adicionales.
			</p>
		</div>

		<!-- Pricing unit selector -->
		<div class="mb-5">
			<Label class="mb-2 text-sm text-slate-600">¿Cómo cobra el proveedor?</Label>
			<div class="grid gap-3 sm:grid-cols-2">
				<button
					type="button"
					class="rounded-lg border-2 p-3 text-left transition-all {formData.pricingUnit ===
					LensPricingUnit.UNIT
						? 'border-blue-500 bg-blue-50/50'
						: 'border-slate-200 hover:border-slate-300'}"
					onclick={() => (formData.pricingUnit = LensPricingUnit.UNIT)}
				>
					<p class="text-sm font-semibold text-slate-800">
						{LENS_PRICING_UNIT_LABELS[LensPricingUnit.UNIT]}
					</p>
					<p class="text-xs text-slate-500">El precio base es por un solo cristal</p>
				</button>
				<button
					type="button"
					class="rounded-lg border-2 p-3 text-left transition-all {formData.pricingUnit ===
					LensPricingUnit.PAIR
						? 'border-indigo-500 bg-indigo-50/50'
						: 'border-slate-200 hover:border-slate-300'}"
					onclick={() => (formData.pricingUnit = LensPricingUnit.PAIR)}
				>
					<p class="text-sm font-semibold text-slate-800">
						{LENS_PRICING_UNIT_LABELS[LensPricingUnit.PAIR]}
					</p>
					<p class="text-xs text-slate-500">El precio base incluye ambos cristales</p>
				</button>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			<div>
				<div class="mb-2 flex items-center gap-1.5">
					<Label for="lc_min_order">Mínimo de unidades</Label>
					<Info id="help-min-order" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-min-order" class="w-56 text-sm" trigger="hover">
						Cantidad mínima que acepta el proveedor por pedido. Default: 1.
					</Popover>
				</div>
				<Input
					id="lc_min_order"
					name="minimumOrderUnits"
					bind:value={formData.minimumOrderUnits}
					type="number"
					min="1"
					class="font-mono"
				/>
			</div>
			<div>
				<div class="mb-2 flex items-center gap-1.5">
					<Label for="lc_surcharge">Recargo por unidad sola ($)</Label>
					<Info id="help-surcharge" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-surcharge" class="w-56 text-sm" trigger="hover">
						Cargo extra que aplica el proveedor si compras un solo cristal en vez del par completo.
						Déjalo en 0 si no aplica.
					</Popover>
				</div>
				<Input
					id="lc_surcharge"
					name="singleUnitSurcharge"
					bind:value={formData.singleUnitSurcharge}
					type="number"
					step="0.01"
					min="0"
					placeholder="0.00"
					class="font-mono placeholder:text-slate-400"
				/>
				{#if parseFloat(formData.singleUnitSurcharge) > 0 && !formData.allowsSingleUnitOrder}
					<p class="mt-1 text-xs text-amber-600">
						Hay recargo definido pero la venta por unidad no está habilitada
					</p>
				{/if}
			</div>
			<div>
				<div class="mb-2 flex items-center gap-1.5">
					<Label for="lc_mounting_price">
						Montaje ($)
						<span class="ml-1 text-xs font-normal text-slate-400">(par)</span>
					</Label>
					<Info id="help-mounting" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-mounting" class="w-56 text-sm" trigger="hover">
						Costo de montaje del cristal en el armazón, cobrado por el par.
					</Popover>
				</div>
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
				<div class="mb-2 flex items-center gap-1.5">
					<Label for="lc_shipping">Envío ($)</Label>
					<Info id="help-shipping" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-shipping" class="w-56 text-sm" trigger="hover">
						Costo de envío que cobra el proveedor por pedido.
					</Popover>
				</div>
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
		</div>
		<div class="mt-4 flex flex-wrap gap-6">
			<div class="flex items-center gap-1.5">
				<Checkbox bind:checked={formData.allowsSingleUnitOrder}>Permite compra por unidad</Checkbox>
				<Info id="help-single-unit" class="h-3.5 w-3.5 cursor-help text-slate-400" />
				<Popover triggeredBy="#help-single-unit" class="w-56 text-sm" trigger="hover">
					Si el proveedor permite pedir un solo cristal (no el par). Útil cuando el paciente solo
					necesita un ojo o hay excedente del otro.
				</Popover>
			</div>
			{#if formData.allowsSingleUnitOrder}
				<div class="flex items-center gap-1.5">
					<Checkbox bind:checked={formData.singleUnitRequiresConfirmation}>
						Requiere confirmación para unidad
					</Checkbox>
					<Info id="help-confirm-unit" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-confirm-unit" class="w-56 text-sm" trigger="hover">
						Hay que confirmar con el proveedor antes de pedir por unidad (no siempre lo acepta).
					</Popover>
				</div>
			{/if}
		</div>
	</div>

	<!-- ================================================================
	     4. PRECIOS
	     ================================================================ -->
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<h3 class="mb-1 text-lg font-semibold text-slate-800">Precios y Disponibilidad</h3>
		<p class="mb-4 text-xs text-slate-400">
			Precio de compra al proveedor, margen de venta sugerido, plazo de entrega y stock actual.
		</p>
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<Label for="lc_price" class="mb-2">
					Precio Compra ($) *
					<span class="ml-1 text-xs font-normal text-slate-400">
						({formData.pricingUnit === LensPricingUnit.PAIR ? 'par' : 'unidad'})
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
				<div class="mb-2 flex items-center gap-1.5">
					<Label for="lc_multiplier">
						Multiplicador
						<span class="ml-1 text-xs font-normal text-slate-400">(sugerido)</span>
					</Label>
					<Info id="help-multiplier" class="h-3.5 w-3.5 cursor-help text-slate-400" />
					<Popover triggeredBy="#help-multiplier" class="w-56 text-sm" trigger="hover">
						Factor que se aplica al costo del cristal para obtener el precio de venta sugerido. Ej:
						costo $100 × 2.5 = venta $250.
					</Popover>
				</div>
				<Input
					id="lc_multiplier"
					name="suggestedMultiplier"
					bind:value={formData.suggestedMultiplier}
					type="number"
					step="0.1"
					min="1"
					placeholder="2.5"
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
	</div>

	<!-- ================================================================
	     5. RANGOS ÓPTICOS
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
			Graduaciones que cubre este cristal. Usa ± para rangos simétricos (positivo y negativo).
		</p>

		{#each ranges as range, i (i)}
			{@const rangeErrors = getRangeErrors(range)}
			<div
				class="relative mb-4 rounded-lg border bg-slate-50/50 p-4 {rangeErrors.length > 0
					? 'border-red-300'
					: 'border-slate-200'} {ranges.length > 1 ? 'pr-10' : ''}"
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
	     6. NOTAS
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
