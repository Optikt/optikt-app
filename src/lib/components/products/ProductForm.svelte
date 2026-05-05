<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Boxes, Coins, ImagePlus, Lock, Package2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createProductForm, updateProductForm } from '$lib/remote/products.remote';
	import {
		CreatableSelect,
		TaxToggle,
		type PendingEntity,
		type SelectOption
	} from '$lib/components/ui';
	import {
		formatPrice,
		getFormErrorMessage,
		scrollToFirstError,
		toastUnboundErrors
	} from '$lib/utils';
	import { buildProductNameSuggestion } from '$lib/utils/productName';
	import { sortOptionsBySuggested } from '$lib/utils/sortOptionsBySuggested';
	import {
		ALL_PRODUCT_TYPES,
		PRODUCT_TYPE_LABELS,
		ProductType,
		toMaterialCategory,
		requiresStockTracking
	} from '$lib/shared/enums';
	import type { Product } from '$lib/server/db/schema';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { generateSku, ProductGender, PRODUCT_GENDER_LABELS } from '$lib/utils/sku';

	interface MaterialOption extends SelectOption {
		productType?: string;
	}

	interface Props {
		product?: Product | null;
		brands: { id: string; name: string }[];
		suppliers: { id: string; name: string }[];
		materials: { id: string; name: string; productType?: string }[];
		brandSupplierMap?: Record<string, string[]>;
		supplierBrandMap?: Record<string, string[]>;
		cancelHref?: string;
		formId?: string;
		showActions?: boolean;
		isSubmitting?: boolean;
	}

	let {
		product = null,
		brands = [],
		suppliers = [],
		materials = [],
		brandSupplierMap = {},
		supplierBrandMap = {},
		cancelHref = '/products',
		formId = 'product-form',
		showActions = true,
		isSubmitting = $bindable(false)
	}: Props = $props();

	const sectionClass = 'glass-card bg-surface-container-lowest p-6';
	const noteCardClass = 'rounded-xl bg-surface-container-low p-4';
	const statCardClass = 'rounded-xl bg-surface-container-low px-4 py-3';
	const fieldLabelClass = 'block text-[10px] font-bold tracking-[0.18em] text-outline uppercase';
	const baseFieldClass =
		'w-full rounded-lg border border-transparent bg-surface-container-low px-4 py-3 text-sm text-brand-navy placeholder:text-outline-variant transition focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15';
	const errorFieldClass =
		'w-full rounded-lg border border-red-300 bg-surface-container-low px-4 py-3 text-sm text-brand-navy placeholder:text-outline-variant transition focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200';
	const helperTextClass = 'mt-1 text-xs text-on-surface-variant';
	const errorTextClass = 'mt-1 text-xs font-medium text-red-600';
	const genderOptions = Object.entries(PRODUCT_GENDER_LABELS) as Array<[ProductGender, string]>;

	const isEditMode = $derived(!!product);
	const submitText = $derived(isEditMode ? 'Guardar cambios' : 'Crear producto');

	let formData = $state({
		sku: '',
		name: '',
		type: ProductType.FRAME as string,
		brandId: '',
		supplierId: '',
		materialId: '',
		gender: ProductGender.NO_APLICA as string,
		personalCode: '',
		color: '',
		size: '',
		description: '',
		isTaxable: true,
		minStock: 0,
		imageUrl: '',
		// Physical attributes — Frames & Sunglasses
		lensWidth: '' as string | number,
		bridgeWidth: '' as string | number,
		templeLength: '' as string | number,
		// Physical attributes — Contact Lenses
		baseCurve: '' as string | number,
		diameter: '' as string | number
	});

	let isAutoSku = $state(true);
	let lastSuggestedName = $state('');

	let pendingBrands = $state<PendingEntity[]>([]);
	let pendingSuppliers = $state<PendingEntity[]>([]);
	let pendingMaterials = $state<PendingEntity[]>([]);
	const pendingModels: PendingEntity[] = [];

	const allBrands = $derived<SelectOption[]>([
		...brands,
		...pendingBrands.map((pendingBrand) => ({
			id: pendingBrand.pendingId,
			name: pendingBrand.name,
			isPending: true
		}))
	]);

	const allSuppliers = $derived<SelectOption[]>([
		...suppliers,
		...pendingSuppliers.map((pendingSupplier) => ({
			id: pendingSupplier.pendingId,
			name: pendingSupplier.name,
			isPending: true
		}))
	]);

	const suggestedSupplierIds = $derived.by(() => {
		if (!formData.brandId || formData.brandId.startsWith('pending_')) return [];
		return brandSupplierMap[formData.brandId] ?? [];
	});

	const suggestedBrandIds = $derived.by(() => {
		if (!formData.supplierId || formData.supplierId.startsWith('pending_')) return [];
		return supplierBrandMap[formData.supplierId] ?? [];
	});

	const orderedBrands = $derived(sortOptionsBySuggested(allBrands, suggestedBrandIds));
	const orderedSuppliers = $derived(sortOptionsBySuggested(allSuppliers, suggestedSupplierIds));

	const allMaterials = $derived.by<MaterialOption[]>(() => {
		const type = formData.type;

		const baseMaterials = materials
			.filter((material) => {
				const materialType = material.productType;
				if (type === ProductType.SUNGLASSES) {
					return materialType === 'FRAME' || materialType === 'SUNGLASSES';
				}
				return materialType === type;
			})
			.map((material) => ({ ...material, isPending: false }));

		const pendingForType = pendingMaterials
			.filter((pendingMaterial) => pendingMaterial.productType === type)
			.map((pendingMaterial) => ({
				id: pendingMaterial.pendingId,
				name: pendingMaterial.name,
				isPending: true,
				productType:
					typeof pendingMaterial.productType === 'string' ? pendingMaterial.productType : undefined
			}));

		return [...baseMaterials, ...pendingForType];
	});

	function handleCreatePendingBrand(name: string): SelectOption {
		const pendingId = `pending_brand_${generateUUID()}`;
		pendingBrands = [...pendingBrands, { pendingId, name }];
		return { id: pendingId, name, isPending: true };
	}

	function handleCreatePendingSupplier(name: string): SelectOption {
		const pendingId = `pending_supplier_${generateUUID()}`;
		pendingSuppliers = [...pendingSuppliers, { pendingId, name }];
		return { id: pendingId, name, isPending: true };
	}

	function handleCreatePendingMaterial(name: string): SelectOption {
		const pendingId = `pending_material_${generateUUID()}`;
		const productType = formData.type;
		pendingMaterials = [...pendingMaterials, { pendingId, name, productType }];
		return { id: pendingId, name, isPending: true };
	}

	function getPendingName(pendingId: string): string | null {
		if (!pendingId.startsWith('pending_')) return null;

		const brand = pendingBrands.find((pendingBrand) => pendingBrand.pendingId === pendingId);
		if (brand) return brand.name;

		const supplier = pendingSuppliers.find(
			(pendingSupplier) => pendingSupplier.pendingId === pendingId
		);
		if (supplier) return supplier.name;

		const material = pendingMaterials.find(
			(pendingMaterial) => pendingMaterial.pendingId === pendingId
		);
		if (material) return material.name;

		const model = pendingModels.find((pendingModel) => pendingModel.pendingId === pendingId);
		if (model) return model.name;

		return null;
	}

	function getPendingMaterialCategory(pendingId: string): string | null {
		if (!pendingId.startsWith('pending_material_')) return null;
		const material = pendingMaterials.find(
			(pendingMaterial) => pendingMaterial.pendingId === pendingId
		);
		return typeof material?.productType === 'string'
			? toMaterialCategory(material.productType as ProductType)
			: null;
	}

	function getIssueText(error: RemoteFormIssue[] | string | null | undefined): string | null {
		return getFormErrorMessage(error);
	}

	function getFieldClass(error: string | null, extraClass = ''): string {
		return `${error ? errorFieldClass : baseFieldClass}${extraClass ? ` ${extraClass}` : ''}`;
	}

	function navigateToCancelHref() {
		goto(resolve(cancelHref as '/'));
	}

	$effect(() => {
		void formData.type;
		untrack(() => {
			const currentMaterial = allMaterials.find((material) => material.id === formData.materialId);
			if (currentMaterial && currentMaterial.productType) {
				const type = formData.type;
				const materialType = currentMaterial.productType;
				if (materialType !== 'ALL' && materialType !== type) {
					if (!(type === ProductType.SUNGLASSES && materialType === 'FRAME')) {
						formData.materialId = '';
					}
				}
			}
		});
	});

	const showStockFields = $derived(requiresStockTracking(formData.type as ProductType));
	const showFrameAttributes = $derived(
		formData.type === ProductType.FRAME || formData.type === ProductType.SUNGLASSES
	);
	const showContactLensAttributes = $derived(formData.type === ProductType.CONTACT_LENS);
	const showGenericSize = $derived(!showFrameAttributes && !showContactLensAttributes);

	let formInstanceId = $state(generateUUID());
	$effect(() => {
		untrack(() => {
			formInstanceId = generateUUID();
			if (product) {
				isAutoSku = product.isAutoSku ?? false;
				formData = {
					sku: product.sku ?? '',
					name: product.name ?? '',
					type: product.type ?? ProductType.FRAME,
					brandId: product.brandId ?? '',
					supplierId: product.supplierId ?? '',
					materialId: product.materialId ?? '',
					gender: product.gender ?? ProductGender.NO_APLICA,
					personalCode: product.personalCode ?? '',
					color: product.color ?? '',
					size: product.size ?? '',
					description: product.description ?? '',
					isTaxable: product.isTaxable ?? true,
					minStock: product.minStock ?? 0,
					imageUrl: product.imageUrl ?? '',
					lensWidth: product.lensWidth ?? '',
					bridgeWidth: product.bridgeWidth ?? '',
					templeLength: product.templeLength ?? '',
					baseCurve: product.baseCurve ?? '',
					diameter: product.diameter ?? ''
				};
			}
		});
	});

	$effect(() => {
		if (isAutoSku) {
			const brandName = allBrands.find((brand) => brand.id === formData.brandId)?.name;
			const materialName = allMaterials.find(
				(material) => material.id === formData.materialId
			)?.name;

			const sku = generateSku({
				type: formData.type as ProductType,
				gender: formData.gender as ProductGender,
				materialName,
				brandName,
				color: formData.color,
				personalCode: formData.personalCode
			});

			untrack(() => {
				formData.sku = sku;
			});
		}
	});

	const suggestedProductName = $derived.by(() => {
		if (isEditMode) return '';

		const brandName = allBrands.find((brand) => brand.id === formData.brandId)?.name;
		const supplierName = allSuppliers.find((supplier) => supplier.id === formData.supplierId)?.name;

		return buildProductNameSuggestion({
			brandName,
			supplierName,
			personalCode: formData.personalCode
		});
	});

	$effect(() => {
		const suggestedName = suggestedProductName;

		if (isEditMode) {
			untrack(() => {
				lastSuggestedName = '';
			});
			return;
		}

		untrack(() => {
			const currentName = formData.name.trim();

			if (!currentName || currentName === lastSuggestedName) {
				formData.name = suggestedName;
			}

			lastSuggestedName = suggestedName;
		});
	});

	const currentCreateForm = $derived(createProductForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateProductForm.for(`${product?.id ?? 'new'}-${formInstanceId}`)
	);
	const activeForm = $derived.by(() => (isEditMode ? currentUpdateForm : currentCreateForm));
	const activeFields = $derived.by(() => activeForm.fields);
	const skuError = $derived.by(() => getIssueText(activeFields.sku?.issues()));
	const nameError = $derived.by(() => getIssueText(activeFields.name?.issues()));
	const typeError = $derived.by(() => getIssueText(activeFields.type?.issues()));
	const materialError = $derived.by(() => getIssueText(activeFields.materialId?.issues()));
	const brandError = $derived.by(() => getIssueText(activeFields.brandId?.issues()));
	const supplierError = $derived.by(() => getIssueText(activeFields.supplierId?.issues()));
	const imageError = $derived.by(() => getIssueText(activeFields.imageUrl?.issues()));
	const hasCommercialReferences = $derived(
		product?.currentPurchasePrice != null || product?.currentSalePrice != null
	);

	const pricingCopy = $derived.by(() => {
		if (hasCommercialReferences) {
			return 'Estas referencias ya existen para el producto, pero no se editan desde este formulario.';
		}
		return null;
		// return 'Este formulario no define costos ni precio de venta. Esas referencias se actualizan desde compras confirmadas y la lista de precios.';
	});

	const taxSummary = $derived.by(() =>
		formData.isTaxable ? 'IVA activo' : 'Producto exento de IVA'
	);

	const inventoryCopy = $derived.by(() =>
		showStockFields
			? 'El stock real se alimenta desde lotes y movimientos FIFO.'
			: 'Este tipo de producto no requiere control de stock.'
	);

	const imagePreviewAvailable = $derived(formData.imageUrl.trim().length > 0);
	const previewAlt = $derived(formData.name.trim().length > 0 ? formData.name : 'producto');

	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Producto creado exitosamente');
		formEl.reset();
		goto(resolve('/products'));
	}

	function handleUpdateResult(formEl: HTMLFormElement) {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Producto actualizado');
		formEl.reset();
		goto(resolve(`/products/${product?.id}` as `/products/${string}`));
	}

	async function handleSubmit(formEl: HTMLFormElement, submit: () => Promise<unknown>) {
		isSubmitting = true;
		try {
			await submit();
			if (isEditMode) {
				handleUpdateResult(formEl);
				return;
			}

			handleCreateResult(formEl);
		} catch (error) {
			console.error(error);
			toast.error(
				error instanceof Error
					? error.message
					: isEditMode
						? 'Error actualizando producto'
						: 'Error creando producto'
			);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form
	id={formId}
	{...activeForm.enhance(async ({ form: formEl, submit }) => {
		await handleSubmit(formEl, submit);
	})}
	class="w-full space-y-6"
>
	{#if isEditMode && product}
		<input type="hidden" name="id" value={product.id} />
	{/if}
	<input type="hidden" name="isAutoSku" value={isAutoSku ? 'true' : 'false'} />

	{#if formData.brandId?.startsWith('pending_')}
		<input type="hidden" name="pendingBrandName" value={getPendingName(formData.brandId) ?? ''} />
	{/if}
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
		<input
			type="hidden"
			name="pendingMaterialCategory"
			value={getPendingMaterialCategory(formData.materialId) ??
				toMaterialCategory(formData.type as ProductType)}
		/>
	{/if}

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(18rem,0.95fr)] xl:items-start">
		<div class="space-y-6">
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
							<label
								class="inline-flex items-center gap-2 text-[11px] font-semibold text-brand-blue"
							>
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
							onCreatePending={handleCreatePendingBrand}
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
							onCreatePending={handleCreatePendingSupplier}
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
							onCreatePending={handleCreatePendingMaterial}
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
					{/if}

					{#if showContactLensAttributes}
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
							class={`${getFieldClass(null)} resize-none`}
						></textarea>
					</div>
				</div>
			</section>

			{#if showActions}
				<div class="flex flex-col-reverse justify-end gap-3 sm:flex-row">
					<button
						type="button"
						onclick={navigateToCancelHref}
						class="rounded-lg px-5 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if isSubmitting}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
							></span>
						{/if}
						{submitText}
					</button>
				</div>
			{/if}
		</div>

		<div class="space-y-6">
			<section class={sectionClass}>
				<div class="mb-5 flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/18 text-brand-navy"
					>
						<Coins size={18} />
					</div>
					<div>
						<h2 class="font-heading text-xl font-semibold text-brand-navy">Precios e impuestos</h2>
					</div>
				</div>

				<div class="space-y-4">
					{#if pricingCopy != null}
						<div class={noteCardClass}>
							<p class="text-[10px] font-bold tracking-[0.18em] text-brand-blue uppercase">
								Estado de precios
							</p>
							<p class="mt-2 text-sm text-on-surface-variant">{pricingCopy}</p>
						</div>
					{/if}

					{#if hasCommercialReferences}
						<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
							{#if product?.currentPurchasePrice != null}
								<div class={statCardClass}>
									<p class="text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
										Costo referencial actual
									</p>
									<p class="mt-2 font-mono text-lg font-semibold text-brand-navy">
										{formatPrice(product.currentPurchasePrice)}
									</p>
									<p class="mt-1 text-xs text-on-surface-variant">
										Viene de la ultima compra confirmada del producto.
									</p>
								</div>
							{/if}

							{#if product?.currentSalePrice != null}
								<div class={statCardClass}>
									<p class="text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
										Precio de venta actual
									</p>
									<p class="mt-2 font-mono text-lg font-semibold text-brand-navy">
										{formatPrice(product.currentSalePrice)}
									</p>
									<p class="mt-1 text-xs text-on-surface-variant">
										Se consulta aqui, pero se ajusta fuera de este formulario.
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class={noteCardClass}>
						<p class="text-[10px] font-bold tracking-[0.18em] text-outline uppercase">Impuestos</p>
						<p class="mt-2 text-sm font-semibold text-brand-navy">{taxSummary}</p>
						<div class="mt-2">
							<TaxToggle
								bind:checked={formData.isTaxable}
								label="Aplica IVA"
								ariaLabel="Alternar IVA del producto"
							/>
						</div>
					</div>
				</div>
			</section>

			<section class={sectionClass}>
				<div class="mb-5 flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/12 text-brand-blue"
					>
						<Boxes size={18} />
					</div>
					<div>
						<h2 class="font-heading text-xl font-semibold text-brand-navy">Gestion de stock</h2>
						<p class="text-sm text-on-surface-variant">Alertas y politica operativa</p>
					</div>
				</div>

				{#if showStockFields}
					<label for="minStock" class={fieldLabelClass}>Stock minimo (alerta)</label>
					<input
						id="minStock"
						name="minStock"
						type="number"
						min="0"
						bind:value={formData.minStock}
						class={getFieldClass(null, 'max-w-[10rem] font-mono tabular-nums')}
					/>

					<div class={`${noteCardClass} mt-4`}>
						<p class="text-[10px] font-bold tracking-[0.18em] text-brand-gold uppercase">
							Operacion
						</p>
						<p class="mt-2 text-sm text-on-surface-variant">{inventoryCopy}</p>
					</div>
				{:else}
					<div class={noteCardClass}>
						<p class="text-sm text-on-surface-variant">{inventoryCopy}</p>
					</div>
				{/if}
			</section>

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
		</div>
	</div>
</form>
