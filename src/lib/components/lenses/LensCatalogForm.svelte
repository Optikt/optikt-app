<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { Info } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import {
		createLensCatalogItemForm,
		updateLensCatalogItemForm,
		listTechnologiesBySupplier
	} from '$lib/remote/lenses.remote';
	import {
		CreatableSelect,
		TaxToggle,
		type SelectOption,
		type PendingEntity
	} from '$lib/components/ui';
	import { getErrorMessage, logger } from '$lib/utils';
	import FormActions from '$lib/components/ui/FormActions.svelte';
	import {
		SPHERE_RANGE_MODE,
		createEmptyOpticalRangeValidation,
		collapseOpticalRangesForForm,
		createEmptyOpticalRangeEntry,
		expandOpticalRanges,
		getOpticalRangePreview,
		hasOpticalRangeValidationErrors,
		toContinuousSphereValues,
		toInverseDuplicateSphereValues,
		validateOpticalRangeEntry,
		type OpticalRangeFormEntry,
		type OpticalRangeValidation
	} from '$lib/utils/opticalRangeForm';
	import {
		LensType,
		LensCatalogSource,
		LensPriceType,
		LensInventoryMode,
		ALL_LENS_TYPES,
		getLensTypeLabel,
		getPriceTypeLabel
	} from '$lib/shared/enums';
	import { scrollToFirstError, toastUnboundErrors, getFormErrorMessage } from '$lib/utils';
	import { formatPrice } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import type { LensCatalogItem, LensOpticalRange } from '$lib/server/db/schema';
	import { resolve } from '$app/paths';
	import { autoAnimate } from '@formkit/auto-animate';

	type Props = {
		item?: LensCatalogItem | null;
		existingRanges?: LensOpticalRange[];
		materials: { id: string; name: string }[];
		suppliers: { id: string; name: string }[];
		differentiators?: string[];
		supplierTechnologies?: { id: string; name: string }[];
		technologyIsGlobal?: boolean;
		cancelHref?: string;
		formId?: string;
		showActions?: boolean;
		isSubmitting?: boolean;
	};

	let {
		item = null,
		existingRanges = [],
		materials = [],
		suppliers = [],
		differentiators = [],
		supplierTechnologies: initialSupplierTechnologies = [],
		technologyIsGlobal: initialTechnologyIsGlobal = false,
		cancelHref = '/lenses',
		formId = 'lens-catalog-form',
		showActions = true,
		isSubmitting = $bindable(false)
	}: Props = $props();

	// Capture initial values (item comes from PageServerLoad, doesn't change)
	const initialItem = untrack(() => item);
	const initialRanges = untrack(() => existingRanges);

	const isEdit = $derived(!!item);
	const helperTextClass = 'mt-1.5 text-xs text-on-surface-variant';
	const formCardClass =
		'rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 md:p-8';
	const sectionTitleClass = 'font-heading text-lg font-semibold text-on-surface';
	const fieldLabelClass = 'text-xs font-semibold tracking-[0.12em] text-outline uppercase';
	const rangeSubLabelClass =
		'mb-1 text-[10px] font-semibold tracking-[0.12em] text-outline uppercase';
	const rangeHeaderRowClass = 'mb-2 flex h-6 items-center';
	const rangeHeaderRowWithToggleClass = `${rangeHeaderRowClass} gap-2`;
	const selectionCardClass =
		'min-h-[96px] rounded-xl border px-4 py-4 text-left transition-all duration-150 ease-[cubic-bezier(0.25,1,0.5,1)]';
	const rangeInputBaseClass =
		'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue font-mono';

	// Form instance
	let formInstanceId = $state(generateUUID());

	const currentCreateForm = $derived(createLensCatalogItemForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateLensCatalogItemForm.for(`${item?.id}-${formInstanceId}`)
	);
	const activeForm = $derived(isEdit ? currentUpdateForm : currentCreateForm);

	// Pending entities
	let pendingSuppliers = $state<PendingEntity[]>([]);
	let pendingMaterials = $state<PendingEntity[]>([]);
	let pendingTechnologies = $state<PendingEntity[]>([]);

	// Form data - numeric fields are strings because they bind to <Input type="number">
	let formData = $state({
		source: (initialItem?.source as LensCatalogSource) ?? LensCatalogSource.LAB,
		supplierId: initialItem?.supplierId ?? '',
		name: initialItem?.name ?? '',
		type: (initialItem?.type as LensType) ?? LensType.MONOFOCAL,
		technologyId: initialItem?.technologyId ?? '',
		differentiators: (initialItem?.differentiators as string[]) ?? [],
		arColors: (initialItem?.arColors as string[]) ?? [],
		photochromicColors: (initialItem?.photochromicColors as string[]) ?? [],
		materialId: initialItem?.materialId ?? '',
		// Inherent traits
		hasAr: initialItem?.hasAr ?? false,
		hasBluecut: initialItem?.hasBluecut ?? false,
		isPhotochromic: initialItem?.isPhotochromic ?? false,
		// Pricing
		priceType: (initialItem?.priceType as LensPriceType) ?? LensPriceType.UNIT,
		basePrice: initialItem?.basePrice?.toString() ?? '0',
		salePrice: initialItem?.salePrice?.toString() ?? '0',
		mountingPrice: initialItem?.mountingPrice?.toString() ?? '0',
		shippingPrice: initialItem?.shippingPrice?.toString() ?? '0',
		// Tax
		isTaxable: initialItem?.isTaxable ?? false,
		// Inventory
		inventoryMode: (initialItem?.inventoryMode as LensInventoryMode) ?? LensInventoryMode.ON_DEMAND,
		stock: initialItem?.stock != null ? initialItem.stock.toString() : '0',
		notes: initialItem?.notes ?? ''
	});

	// Comma-separated text states for arrays
	let differentiatorsText = $state(
		initialItem?.differentiators ? (initialItem.differentiators as string[]).join(', ') : ''
	);
	let arColorsText = $state(
		initialItem?.arColors ? (initialItem.arColors as string[]).join(', ') : ''
	);
	let photochromicColorsText = $state(
		initialItem?.photochromicColors ? (initialItem.photochromicColors as string[]).join(', ') : ''
	);

	// Reactively update array fields from comma-separated inputs
	$effect(() => {
		formData.differentiators = differentiatorsText
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	});
	$effect(() => {
		formData.arColors = arColorsText
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	});
	$effect(() => {
		formData.photochromicColors = photochromicColorsText
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	});

	// Dynamic supplier technologies list
	let supplierTechnologies = $state<Array<{ id: string; name: string }>>(
		untrack(() => initialSupplierTechnologies)
	);
	let isGlobalTechnology = $state(untrack(() => initialTechnologyIsGlobal));

	function handleSupplierChange(selected: { id: string; name: string } | null) {
		const supplierId = selected?.id ?? '';
		formData.supplierId = supplierId;
		formData.technologyId = '';
		listTechnologiesBySupplier({
			supplierId: supplierId && !supplierId.startsWith('pending_') ? supplierId : undefined
		})
			.then((res) => {
				supplierTechnologies = res;
			})
			.catch((err) => {
				logger.error('Error cargando tecnologías del proveedor', err);
				supplierTechnologies = [];
			});
	}

	// Live pair purchase price - always the cost of two lenses
	let livePairPurchasePrice = $derived.by(() => {
		const base = parseFloat(formData.basePrice) || 0;
		return formData.priceType === LensPriceType.UNIT ? base * 2 : base;
	});

	let liveOperationalCost = $derived.by(() => {
		const mounting = parseFloat(formData.mountingPrice) || 0;
		const shipping = parseFloat(formData.shippingPrice) || 0;
		return livePairPurchasePrice + mounting + shipping;
	});

	let liveGrossProfit = $derived.by(() => {
		const sale = parseFloat(formData.salePrice) || 0;
		if (sale <= 0) return null;
		return sale - liveOperationalCost;
	});

	// Gross margin over sale price, aligned with the summary card.
	let liveMarginPercent = $derived.by(() => {
		const sale = parseFloat(formData.salePrice) || 0;
		if (sale <= 0 || liveGrossProfit == null) return null;
		return (liveGrossProfit / sale) * 100;
	});

	let totalWithTax = $derived.by(() => {
		const sale = parseFloat(formData.salePrice) || 0;
		if (sale <= 0) return 0;
		return sale;
	});

	// Dynamic optical ranges
	let ranges = $state<OpticalRangeFormEntry[]>(
		initialRanges.length > 0 ? collapseOpticalRangesForForm(initialRanges) : []
	);

	// Start with one empty range for FINISHED lenses (new items only)
	$effect(() => {
		if (ranges.length === 0 && !item) {
			untrack(() => {
				if (formData.source === LensCatalogSource.FINISHED) {
					ranges = [createEmptyOpticalRangeEntry()];
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

	const supplierHelperText = $derived.by(() => {
		if (!formData.supplierId) return 'Selecciona o crea el proveedor responsable de este lente.';
		if (formData.supplierId.startsWith('pending_')) {
			return 'Este proveedor no existe. Se creara un nuevo registro al guardar.';
		}
		return 'Este proveedor ya esta registrado en el sistema.';
	});

	const materialHelperText = $derived.by(() => {
		if (!formData.materialId) return 'Selecciona o crea el material base del cristal.';
		if (formData.materialId.startsWith('pending_')) {
			return 'Este material no existe. Se creara un nuevo registro al guardar.';
		}
		return 'Este material ya esta registrado y listo para reutilizar.';
	});

	const technologyHelperText =
		'Selecciona la tecnología de fabricación digital para este lente de laboratorio.';

	const differentiatorHelperText = $derived.by(() =>
		differentiators.length > 0
			? `Opcional: etiquetas descriptivas separadas por comas (sugeridas: ${differentiators.slice(0, 3).join(', ')}).`
			: 'Opcional: etiquetas descriptivas separadas por comas (ej. Cilindro Alto 2, UV400).'
	);

	// Auto-name generation
	let autoNameEnabled = $state(true);

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
		if (formData.technologyId) {
			const tech = supplierTechnologies.find((t) => t.id === formData.technologyId);
			const pendingTech = pendingTechnologies.find((t) => t.pendingId === formData.technologyId);
			if (tech) parts.push(tech.name);
			else if (pendingTech) parts.push(pendingTech.name);
		}

		// Differentiators (optional)
		if (formData.differentiators && formData.differentiators.length > 0) {
			parts.push(formData.differentiators.join(' · '));
		}

		// Treatments (optional tags)
		if (formData.isPhotochromic) {
			parts.push('FOTO');
			if (formData.photochromicColors && formData.photochromicColors.length > 0) {
				parts.push(`(${formData.photochromicColors.join('/')})`);
			}
		}
		if (formData.hasAr) {
			parts.push('AR');
			if (formData.arColors && formData.arColors.length > 0) {
				parts.push(`(${formData.arColors.join('/')})`);
			}
		}
		if (formData.hasBluecut) parts.push('BLUE');

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
		ranges = [...ranges, createEmptyOpticalRangeEntry()];
	}

	function removeRange(index: number) {
		ranges = ranges.filter((_, i) => i !== index);
	}

	function toggleSphereMode(range: OpticalRangeFormEntry) {
		if (range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE) {
			range.sphereMode = SPHERE_RANGE_MODE.CONTINUOUS;
			const continuousValues = toContinuousSphereValues(range.inverseOuter);
			range.sphereMin = continuousValues.sphereMin;
			range.sphereMax = continuousValues.sphereMax;
			return;
		}

		range.sphereMode = SPHERE_RANGE_MODE.INVERSE_DUPLICATE;
		const inverseValues = toInverseDuplicateSphereValues(range.sphereMin, range.sphereMax);
		range.inverseOuter = inverseValues.inverseOuter;
		range.inverseInner = inverseValues.inverseInner;
	}

	const serializedRanges = $derived(JSON.stringify(expandOpticalRanges(ranges)));

	type RangeValidationGroup = 'sphere' | 'cylinder' | 'addition';

	function getRangeInputClass(hasError: boolean, extraClass = ''): string {
		return `${rangeInputBaseClass} ${
			hasError
				? 'border border-error/40 ring-1 ring-error/15 focus:border-error focus:ring-error/20'
				: 'border-0'
		} ${extraClass}`.trim();
	}

	function pushUniqueValidationMessage(errors: string[], message: string) {
		if (!errors.includes(message)) {
			errors.push(message);
		}
	}

	function mergeRangeValidation(
		clientValidation: OpticalRangeValidation,
		serverValidation?: OpticalRangeValidation
	): OpticalRangeValidation {
		const merged = createEmptyOpticalRangeValidation();

		for (const group of ['sphere', 'cylinder', 'addition'] as const) {
			for (const message of clientValidation[group]) {
				pushUniqueValidationMessage(merged[group], message);
			}

			for (const message of serverValidation?.[group] ?? []) {
				pushUniqueValidationMessage(merged[group], message);
			}
		}

		return merged;
	}

	function getRangeIssueLocation(
		issue: RemoteFormIssue
	): { index?: number; field?: string } | null {
		if (Array.isArray(issue.path) && issue.path[0] === 'ranges') {
			return {
				index: typeof issue.path[1] === 'number' ? issue.path[1] : undefined,
				field:
					typeof issue.path[2] === 'string'
						? issue.path[2]
						: typeof issue.path[1] === 'string'
							? issue.path[1]
							: undefined
			};
		}

		return null;
	}

	function getRangeValidationGroup(field?: string): RangeValidationGroup | null {
		if (!field) return null;
		if (field.startsWith('sphere')) return 'sphere';
		if (field.startsWith('cylinder')) return 'cylinder';
		if (field.startsWith('addition')) return 'addition';
		return null;
	}

	function buildServerRangeValidations(issues: RemoteFormIssue[]): OpticalRangeValidation[] {
		const validations: OpticalRangeValidation[] = [];

		for (const issue of issues) {
			const location = getRangeIssueLocation(issue);
			if (!location || location.index === undefined) continue;

			const group = getRangeValidationGroup(location.field);
			if (!group) continue;

			const validation = validations[location.index] ?? createEmptyOpticalRangeValidation();
			pushUniqueValidationMessage(validation[group], issue.message);
			validations[location.index] = validation;
		}

		return validations;
	}

	function getRootRangeIssues(issues: RemoteFormIssue[]): RemoteFormIssue[] {
		return issues.filter((issue) => {
			const location = getRangeIssueLocation(issue);
			return location !== null && location.index === undefined;
		});
	}

	function isRenderedRangeIssue(issue: RemoteFormIssue): boolean {
		return getRangeIssueLocation(issue) !== null;
	}

	function toastUnboundNonRangeIssues(allIssues: RemoteFormIssue[]) {
		toastUnboundErrors(allIssues.filter((issue) => !isRenderedRangeIssue(issue)));
	}

	const clientRangeValidations = $derived.by(() =>
		ranges.map((r) =>
			validateOpticalRangeEntry(r, {
				requireAddition: showAddition,
				skipAddition: !showAddition
			})
		)
	);
	const hasClientRangeErrors = $derived.by(() =>
		clientRangeValidations.some(hasOpticalRangeValidationErrors)
	);
	const rangeServerIssues = $derived.by(() => activeForm.fields.allIssues?.() ?? []);
	const serverRangeValidations = $derived.by(() => buildServerRangeValidations(rangeServerIssues));
	const rootRangeIssues = $derived.by(() => getRootRangeIssues(rangeServerIssues));

	async function runValidatedSubmit(
		submit: () => Promise<unknown>,
		onSuccess: () => void,
		fallbackMessage: string
	) {
		isSubmitting = true;

		try {
			if (hasClientRangeErrors) {
				toast.error('Corrige los errores marcados en los rangos ópticos');
				scrollToFirstError();
				return;
			}

			await submit();
			onSuccess();
		} catch (e) {
			toast.error(getErrorMessage(e, fallbackMessage));
		} finally {
			isSubmitting = false;
		}
	}

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

	function handleCreatePendingTechnology(name: string): SelectOption {
		const pendingId = `pending_technology_${generateUUID()}`;
		pendingTechnologies = [...pendingTechnologies, { pendingId, name }];
		return { id: pendingId, name, isPending: true };
	}

	function getPendingName(pendingId: string): string | null {
		if (!pendingId.startsWith('pending_')) return null;
		const sup = pendingSuppliers.find((s) => s.pendingId === pendingId);
		if (sup) return sup.name;
		const mat = pendingMaterials.find((m) => m.pendingId === pendingId);
		if (mat) return mat.name;
		const tech = pendingTechnologies.find((t) => t.pendingId === pendingId);
		if (tech) return tech.name;
		return null;
	}

	function handleCreateResult() {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toast.error('Por favor corrige los errores del formulario');
			scrollToFirstError();
			toastUnboundNonRangeIssues(allIssues);
			return;
		}
		const result = currentCreateForm.result;
		const createdId =
			typeof result === 'object' &&
			result !== null &&
			'id' in result &&
			typeof result.id === 'string'
				? result.id
				: null;
		toast.success('Lente agregado al catálogo');
		goto(resolve(createdId ? `/lenses/${createdId}` : '/lenses'));
	}

	function handleUpdateResult() {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toast.error('Por favor corrige los errores del formulario');
			scrollToFirstError();
			toastUnboundNonRangeIssues(allIssues);
			return;
		}
		toast.success('Lente actualizado');
		goto(resolve(`/lenses/${item!.id}`));
	}
</script>

<div class="w-full">
	{#if isEdit && item}
		<form
			id={formId}
			{...currentUpdateForm.enhance(async ({ submit }) => {
				await runValidatedSubmit(submit, handleUpdateResult, 'Error actualizando lente');
			})}
			class="space-y-6"
		>
			<input type="hidden" name="id" value={item.id} />
			{@render pendingHiddenInputs()}
			{@render formFields()}
			{#if showActions}
				{@render formActions()}
			{/if}
		</form>
	{:else}
		<form
			id={formId}
			{...currentCreateForm.enhance(async ({ submit }) => {
				await runValidatedSubmit(submit, handleCreateResult, 'Error creando lente');
			})}
			class="space-y-6"
		>
			{@render pendingHiddenInputs()}
			{@render formFields()}
			{#if showActions}
				{@render formActions()}
			{/if}
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
	{#if formData.technologyId?.startsWith('pending_technology_')}
		<input
			type="hidden"
			name="pendingTechnologyName"
			value={getPendingName(formData.technologyId) ?? ''}
		/>
	{/if}
{/snippet}

{#snippet formFields()}
	<input type="hidden" name="source" value={formData.source} />
	<input type="hidden" name="hasAr" value={String(formData.hasAr)} />
	<input type="hidden" name="hasBluecut" value={String(formData.hasBluecut)} />
	<input type="hidden" name="isPhotochromic" value={String(formData.isPhotochromic)} />
	<input type="hidden" name="isGlobalTechnology" value={String(isGlobalTechnology)} />
	<input type="hidden" name="priceType" value={formData.priceType} />
	<input type="hidden" name="ranges" value={serializedRanges} />
	<input type="hidden" name="differentiators" value={JSON.stringify(formData.differentiators)} />
	<input type="hidden" name="arColors" value={JSON.stringify(formData.arColors)} />
	<input
		type="hidden"
		name="photochromicColors"
		value={JSON.stringify(formData.photochromicColors)}
	/>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<div class="space-y-6 lg:col-span-7">
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
							onCreatePending={handleCreatePendingSupplier}
							onchange={handleSupplierChange}
							error={activeForm.fields.supplierId?.issues()
								? getFormErrorMessage(activeForm.fields.supplierId.issues())
								: null}
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
							onCreatePending={handleCreatePendingMaterial}
							error={activeForm.fields.materialId?.issues()
								? getFormErrorMessage(activeForm.fields.materialId.issues())
								: null}
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
						onCreatePending={handleCreatePendingSupplier}
						onchange={handleSupplierChange}
						error={activeForm.fields.supplierId?.issues()
							? getFormErrorMessage(activeForm.fields.supplierId.issues())
							: null}
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
							onCreatePending={handleCreatePendingTechnology}
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
							class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-2 placeholder:text-outline"
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
							class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue placeholder:text-outline"
							required
							disabled={autoNameEnabled}
						/>
						{#if activeForm.fields.name?.issues()}
							<p class="mt-1 text-xs text-error">
								{getFormErrorMessage(activeForm.fields.name.issues())}
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
											class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-1 placeholder:text-outline"
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
											class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-1 placeholder:text-outline"
										/>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</section>

			<section class={formCardClass}>
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-brand-blue"></span>
						<h3 class={sectionTitleClass}>Rangos opticos</h3>
						<span class="relative group cursor-help">
							<Info class="h-4 w-4 text-outline" />
							<span
								class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 rounded-lg bg-slate-800 p-3 text-sm text-white shadow-lg z-50"
							>
								<p class="mb-1 font-medium">¿Qué son los rangos?</p>
								<p>
									Definen qué graduaciones puede cubrir este cristal. La esfera puede ser continua
									como -4.00 a +4.00, o un duplicado inverso como ±4.00 a ±2.00, que guarda dos
									rangos espejo y deja libre el centro.
								</p>
							</span>
						</span>
					</div>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-brand-blue transition-colors hover:bg-info-container/35 hover:text-brand-navy"
						onclick={addRange}
					>
						<span aria-hidden="true">+</span>
						Agregar rango
					</button>
				</div>

				<div class="mt-6 space-y-4" use:autoAnimate>
					{#if ranges.length === 0}
						<div class="rounded-xl bg-surface-container-low px-6 py-8 text-center">
							<p class="text-sm text-on-surface-variant">
								{formData.source === LensCatalogSource.LAB
									? 'Sin rangos definidos. El laboratorio confirmará disponibilidad por pedido.'
									: 'Agrega al menos un rango para este lente terminado.'}
							</p>
						</div>
					{/if}

					{#each ranges as range, i (i)}
						{@const rangeValidation = mergeRangeValidation(
							clientRangeValidations[i] ?? createEmptyOpticalRangeValidation(),
							serverRangeValidations[i]
						)}
						{@const sphereErrors = rangeValidation.sphere}
						{@const cylinderErrors = rangeValidation.cylinder}
						{@const additionErrors = rangeValidation.addition}
						{@const sphereHasErrors = sphereErrors.length > 0}
						{@const cylinderHasErrors = cylinderErrors.length > 0}
						{@const additionHasErrors = additionErrors.length > 0}
						{@const previewLines = getOpticalRangePreview(range)}
						{@const sphereStartLabel =
							range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE ? 'Exterior' : 'Desde'}
						{@const sphereEndLabel =
							range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE ? 'Interior' : 'Hasta'}
						<div class="rounded-xl bg-surface-container-low p-5" use:autoAnimate>
							<div class="grid gap-4 lg:grid-cols-12">
								<div class={showAddition ? 'lg:col-span-4' : 'lg:col-span-6'}>
									<div class={rangeHeaderRowWithToggleClass}>
										<Label class={fieldLabelClass}>Esfera (ESF)</Label>
										<span class="relative group">
											<button
												type="button"
												aria-pressed={range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE}
												class="inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs leading-none font-semibold transition-colors {range.sphereMode ===
												SPHERE_RANGE_MODE.INVERSE_DUPLICATE
													? 'border-brand-blue/60 bg-brand-navy text-white'
													: 'border-outline-variant/40 bg-white text-brand-navy hover:border-brand-blue/40 hover:text-brand-blue'}"
												onclick={() => toggleSphereMode(range)}
											>
												±
											</button>
											<span
												class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 rounded-lg bg-slate-800 p-3 text-sm text-white shadow-lg z-50"
											>
												<p class="font-medium text-white">
													{range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE
														? 'Duplicado inverso activado'
														: 'Duplicado inverso desactivado'}
												</p>
												<p class="mt-1 text-white/80">
													{range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE
														? 'Los campos pasan a ser ± exterior e ± interior, y al guardar se crean dos rangos espejo.'
														: 'Los campos se leen como desde y hasta, y al guardar se crea un solo rango continuo.'}
												</p>
											</span>
										</span>
									</div>
									<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
										{#if range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE}
											<div>
												<p class={rangeSubLabelClass}>{sphereStartLabel}</p>
												<input
													bind:value={range.inverseOuter}
													aria-invalid={sphereHasErrors}
													type="number"
													min="0"
													max="30"
													step="0.25"
													placeholder="4.00"
													class={getRangeInputClass(sphereHasErrors)}
												/>
											</div>
										{:else}
											<div>
												<p class={rangeSubLabelClass}>{sphereStartLabel}</p>
												<input
													bind:value={range.sphereMin}
													aria-invalid={sphereHasErrors}
													type="number"
													min="-30"
													max="30"
													step="0.25"
													placeholder="-4.00"
													class={getRangeInputClass(sphereHasErrors)}
												/>
											</div>
										{/if}
										<span class="pb-2 text-xs text-outline">/</span>
										{#if range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE}
											<div>
												<p class={rangeSubLabelClass}>{sphereEndLabel}</p>
												<input
													bind:value={range.inverseInner}
													aria-invalid={sphereHasErrors}
													type="number"
													min="0"
													max="30"
													step="0.25"
													placeholder="2.00"
													class={getRangeInputClass(sphereHasErrors)}
												/>
											</div>
										{:else}
											<div>
												<p class={rangeSubLabelClass}>{sphereEndLabel}</p>
												<input
													bind:value={range.sphereMax}
													aria-invalid={sphereHasErrors}
													type="number"
													min="-30"
													max="30"
													step="0.25"
													placeholder="+4.00"
													class={getRangeInputClass(sphereHasErrors)}
												/>
											</div>
										{/if}
									</div>
									{#if sphereErrors.length > 0}
										<div class="mt-2 space-y-1">
											{#each sphereErrors as err (`sphere-${i}-${err}`)}
												<p class="text-xs text-error">{err}</p>
											{/each}
										</div>
									{/if}
								</div>

								<div class={showAddition ? 'lg:col-span-4' : 'lg:col-span-6'}>
									<div class={rangeHeaderRowClass}>
										<Label class={fieldLabelClass}>Cilindro (CIL)</Label>
									</div>
									<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
										<div>
											<p class={rangeSubLabelClass}>Minimo</p>
											<input
												bind:value={range.cylinderMin}
												aria-invalid={cylinderHasErrors}
												type="number"
												min="-10"
												max="0"
												step="0.25"
												placeholder="Min"
												class={getRangeInputClass(cylinderHasErrors)}
											/>
										</div>
										<span class="pb-2 text-xs text-outline">/</span>
										<div>
											<p class={rangeSubLabelClass}>Maximo</p>
											<input
												bind:value={range.cylinderMax}
												aria-invalid={cylinderHasErrors}
												type="number"
												min="-10"
												max="0"
												step="0.25"
												placeholder="Max"
												class={getRangeInputClass(cylinderHasErrors)}
											/>
										</div>
									</div>
									{#if cylinderErrors.length > 0}
										<div class="mt-2 space-y-1">
											{#each cylinderErrors as err (`cylinder-${i}-${err}`)}
												<p class="text-xs text-error">{err}</p>
											{/each}
										</div>
									{/if}
								</div>

								{#if showAddition}
									<div class="lg:col-span-4">
										<div class={rangeHeaderRowClass}>
											<Label class={fieldLabelClass}>Adicion (ADD)</Label>
										</div>
										<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
											<div>
												<p class={rangeSubLabelClass}>Minimo</p>
												<input
													bind:value={range.additionMin}
													aria-invalid={additionHasErrors}
													type="number"
													min="0"
													max="5"
													step="0.25"
													placeholder="Min"
													class={getRangeInputClass(additionHasErrors)}
												/>
											</div>
											<span class="pb-2 text-xs text-outline">/</span>
											<div>
												<p class={rangeSubLabelClass}>Maximo</p>
												<input
													bind:value={range.additionMax}
													aria-invalid={additionHasErrors}
													type="number"
													min="0"
													max="5"
													step="0.25"
													placeholder="Max"
													class={getRangeInputClass(additionHasErrors)}
												/>
											</div>
										</div>
										{#if additionErrors.length > 0}
											<div class="mt-2 space-y-1">
												{#each additionErrors as err (`addition-${i}-${err}`)}
													<p class="text-xs text-error">{err}</p>
												{/each}
											</div>
										{/if}
									</div>
								{/if}
							</div>

							<div
								class="mt-4 flex items-end justify-between gap-3 border-t border-outline-variant/20 pt-4"
							>
								<div class="space-y-1">
									<p class={fieldLabelClass}>Resultado</p>
									{#each previewLines as line, li (`${i}-${li}`)}
										<p class="font-mono leading-tight font-semibold text-on-surface tabular-nums">
											{line}
										</p>
									{/each}
								</div>
								<button
									type="button"
									class="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-error"
									onclick={() => removeRange(i)}>Quitar</button
								>
							</div>
						</div>
					{/each}

					{#if rootRangeIssues.length > 0}
						<div class="space-y-1">
							{#each rootRangeIssues as issue, issueIndex (`range-root-${issueIndex}-${issue.message}`)}
								<p class="text-xs text-error">{issue.message}</p>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>

		<div class="space-y-6 lg:col-span-5">
			<section class={formCardClass}>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-error"></span>
					<h3 class={sectionTitleClass}>Estructura de costos y venta</h3>
				</div>

				<div class="mt-6 space-y-4">
					<div>
						<p class={fieldLabelClass}>Como cobra el proveedor</p>
						<div class="mt-3 grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								aria-pressed={formData.priceType === LensPriceType.UNIT}
								class="{selectionCardClass} {formData.priceType === LensPriceType.UNIT
									? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
									: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
								onclick={() => (formData.priceType = LensPriceType.UNIT)}
							>
								<div>
									<p
										class="text-sm font-semibold {formData.priceType === LensPriceType.UNIT
											? 'text-white'
											: 'text-on-surface'}"
									>
										{getPriceTypeLabel(LensPriceType.UNIT)}
									</p>
									<p
										class="mt-1 text-xs leading-5 {formData.priceType === LensPriceType.UNIT
											? 'text-white/75'
											: 'text-on-surface-variant'}"
									>
										El costo base corresponde a un solo lente.
									</p>
								</div>
							</button>
							<button
								type="button"
								aria-pressed={formData.priceType === LensPriceType.PAIR}
								class="{selectionCardClass} {formData.priceType === LensPriceType.PAIR
									? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
									: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
								onclick={() => (formData.priceType = LensPriceType.PAIR)}
							>
								<div>
									<p
										class="text-sm font-semibold {formData.priceType === LensPriceType.PAIR
											? 'text-white'
											: 'text-on-surface'}"
									>
										{getPriceTypeLabel(LensPriceType.PAIR)}
									</p>
									<p
										class="mt-1 text-xs leading-5 {formData.priceType === LensPriceType.PAIR
											? 'text-white/75'
											: 'text-on-surface-variant'}"
									>
										El costo base ya incluye el par completo.
									</p>
								</div>
							</button>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<Label for="lc_price" class={fieldLabelClass}>Costo proveedor (base)</Label>
							<div class="relative mt-2">
								<span
									class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-outline"
									>$</span
								>
								<input
									id="lc_price"
									name="basePrice"
									bind:value={formData.basePrice}
									type="number"
									step="0.01"
									min="0"
									class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue pl-7 font-mono"
									required
								/>
							</div>
						</div>
						<div>
							<p class={fieldLabelClass}>Costo por par (calculado)</p>
							<div
								class="bg-secondary-container/20 mt-2 flex h-[42px] items-center rounded-xl px-4 font-mono text-sm font-bold text-brand-blue"
							>
								$ {livePairPurchasePrice.toFixed(2)}
							</div>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-3">
						<div>
							<Label for="lc_mounting_price" class={fieldLabelClass}>Montaje</Label>
							<input
								id="lc_mounting_price"
								name="mountingPrice"
								bind:value={formData.mountingPrice}
								type="number"
								step="0.01"
								min="0"
								class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-2 font-mono"
							/>
						</div>
						<div>
							<Label for="lc_shipping" class={fieldLabelClass}>Envio</Label>
							<input
								id="lc_shipping"
								name="shippingPrice"
								bind:value={formData.shippingPrice}
								type="number"
								step="0.01"
								min="0"
								class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-2 font-mono"
							/>
						</div>
						<div>
							<Label for="lc_sale_price" class={fieldLabelClass}>Precio venta</Label>
							<input
								id="lc_sale_price"
								name="salePrice"
								bind:value={formData.salePrice}
								type="number"
								step="0.01"
								min="0"
								class="block w-full rounded-lg border border-slate-300 bg-brand-navy px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-2 font-mono font-bold text-white"
							/>
						</div>
					</div>

					<div class="rounded-xl bg-surface-container-high/40 px-5 py-5">
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class={fieldLabelClass}>Margen estimado</p>
								<p
									class="font-heading mt-2 text-3xl font-semibold tracking-[-0.02em] text-brand-navy tabular-nums"
								>
									{liveMarginPercent != null ? `${liveMarginPercent.toFixed(1)}%` : '-'}
								</p>
							</div>
							<div class="text-right">
								<p class={fieldLabelClass}>Utilidad bruta</p>
								<p class="mt-2 font-mono text-2xl font-semibold text-brand-blue tabular-nums">
									{liveGrossProfit != null ? formatPrice(liveGrossProfit) : '-'}
								</p>
							</div>
						</div>
					</div>

					<div class="flex flex-col gap-3 pt-1">
						<div class="flex items-center justify-between gap-4">
							<TaxToggle bind:checked={formData.isTaxable} label="Gravable (IVA)" />
							<p class="text-xs text-on-surface-variant">
								Total con impuesto: {formatPrice(totalWithTax)}
							</p>
						</div>
					</div>
				</div>
			</section>

			<section class={formCardClass}>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-brand-blue"></span>
					<h3 class={sectionTitleClass}>Gestion</h3>
				</div>

				<div class="mt-6 space-y-6">
					<div>
						<p class={fieldLabelClass}>Modalidad de inventario</p>
						{#if formData.source === LensCatalogSource.FINISHED}
							<input type="hidden" name="inventoryMode" value={formData.inventoryMode} />
							<div class="mt-3 grid gap-3 sm:grid-cols-2">
								<button
									type="button"
									aria-pressed={formData.inventoryMode === LensInventoryMode.STOCK}
									class="{selectionCardClass} {formData.inventoryMode === LensInventoryMode.STOCK
										? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
										: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
									onclick={() => (formData.inventoryMode = LensInventoryMode.STOCK)}
								>
									<div>
										<p
											class="text-sm font-semibold {formData.inventoryMode ===
											LensInventoryMode.STOCK
												? 'text-white'
												: 'text-on-surface'}"
										>
											Stock
										</p>
										<p
											class="mt-1 text-xs leading-5 {formData.inventoryMode ===
											LensInventoryMode.STOCK
												? 'text-white/75'
												: 'text-on-surface-variant'}"
										>
											Se descuenta del inventario disponible.
										</p>
									</div>
								</button>
								<button
									type="button"
									aria-pressed={formData.inventoryMode === LensInventoryMode.ON_DEMAND}
									class="{selectionCardClass} {formData.inventoryMode ===
									LensInventoryMode.ON_DEMAND
										? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
										: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
									onclick={() => (formData.inventoryMode = LensInventoryMode.ON_DEMAND)}
								>
									<div>
										<p
											class="text-sm font-semibold {formData.inventoryMode ===
											LensInventoryMode.ON_DEMAND
												? 'text-white'
												: 'text-on-surface'}"
										>
											Bajo pedido
										</p>
										<p
											class="mt-1 text-xs leading-5 {formData.inventoryMode ===
											LensInventoryMode.ON_DEMAND
												? 'text-white/75'
												: 'text-on-surface-variant'}"
										>
											Se compra al proveedor cuando se confirma la venta.
										</p>
									</div>
								</button>
							</div>

							{#if formData.inventoryMode === LensInventoryMode.STOCK}
								<div class="mt-4">
									<Label for="lc_stock" class={fieldLabelClass}>Cantidad en stock</Label>
									<input
										id="lc_stock"
										name="stock"
										bind:value={formData.stock}
										type="number"
										min="0"
										class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-2 font-mono"
									/>
								</div>
							{/if}
						{:else}
							<input type="hidden" name="inventoryMode" value={LensInventoryMode.ON_DEMAND} />
							<div
								class="mt-3 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-4 text-sm text-on-surface-variant"
							>
								Los lentes de laboratorio se gestionan siempre bajo pedido.
							</div>
						{/if}
					</div>

					<div class="rounded-xl bg-surface-container-low px-4 py-4">
						<p class={fieldLabelClass}>Notas internas</p>
						<textarea
							id="lc_notes"
							name="notes"
							bind:value={formData.notes}
							rows={3}
							placeholder="Acuerdos con proveedor, restricciones o notas operativas..."
							class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue mt-3"
						></textarea>
					</div>
				</div>
			</section>
		</div>
	</div>
{/snippet}

{#snippet formActions()}
	<FormActions
		primaryLabel={isEdit ? 'Actualizar' : 'Agregar al Catálogo'}
		{cancelHref}
		{isSubmitting}
	/>
{/snippet}
