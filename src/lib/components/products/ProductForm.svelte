<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createProductForm, updateProductForm } from '$lib/remote/products.remote';
	import type { PendingEntity, SelectOption } from '$lib/components/ui';
	import { getErrorMessage, scrollToFirstError, toastUnboundErrors } from '$lib/utils';
	import { buildProductNameSuggestion } from '$lib/utils/productName';
	import { sortOptionsBySuggested } from '$lib/utils/sortOptionsBySuggested';
	import { ProductType, requiresStockTracking, toMaterialCategory } from '$lib/shared/enums';
	import type { Product } from '$lib/server/db/schema';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { generateSku, ProductGender } from '$lib/utils/sku';
	import { getIssueText } from './form/productFormClasses';
	import {
		getPendingMaterialCategory as resolvePendingMaterialCategory,
		getPendingName as resolvePendingName,
		handleCreatePendingBrand as buildPendingBrand,
		handleCreatePendingMaterial as buildPendingMaterial,
		handleCreatePendingSupplier as buildPendingSupplier
	} from './form/pendingEntities';
	import type { ProductFormData } from './form/productFormTypes';
	import ProductFormActions from './form/ProductFormActions.svelte';
	import ProductGeneralSection from './form/ProductGeneralSection.svelte';
	import ProductImageSection from './form/ProductImageSection.svelte';
	import ProductPricingSection from './form/ProductPricingSection.svelte';
	import ProductStockSection from './form/ProductStockSection.svelte';

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

	const isEditMode = $derived(!!product);
	const submitText = $derived(isEditMode ? 'Guardar cambios' : 'Crear producto');

	let formData = $state<ProductFormData>({
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
		const { updated, option } = buildPendingBrand(pendingBrands, name);
		pendingBrands = updated;
		return option;
	}

	function handleCreatePendingSupplier(name: string): SelectOption {
		const { updated, option } = buildPendingSupplier(pendingSuppliers, name);
		pendingSuppliers = updated;
		return option;
	}

	function handleCreatePendingMaterial(name: string): SelectOption {
		const { updated, option } = buildPendingMaterial(pendingMaterials, name, formData.type);
		pendingMaterials = updated;
		return option;
	}

	function getPendingName(pendingId: string): string | null {
		return resolvePendingName(
			pendingId,
			pendingBrands,
			pendingSuppliers,
			pendingMaterials,
			pendingModels
		);
	}

	function getPendingMaterialCategory(pendingId: string): string | null {
		return resolvePendingMaterialCategory(pendingId, pendingMaterials);
	}

	function navigateToCancelHref() {
		// FIXME: resolve tipado estrictamente por SvelteKit, no acepta string genérico
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
			toast.error(
				getErrorMessage(
					error,
					isEditMode ? 'Error actualizando producto' : 'Error creando producto'
				)
			);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<form
	id={formId}
	{...activeForm.enhance(async ({ element: formEl, submit }) => {
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
			<ProductGeneralSection
				{formData}
				bind:isAutoSku
				{orderedBrands}
				{orderedSuppliers}
				{allMaterials}
				{showFrameAttributes}
				{showContactLensAttributes}
				{showGenericSize}
				{skuError}
				{nameError}
				{typeError}
				{brandError}
				{supplierError}
				{materialError}
				onCreatePendingBrand={handleCreatePendingBrand}
				onCreatePendingSupplier={handleCreatePendingSupplier}
				onCreatePendingMaterial={handleCreatePendingMaterial}
			/>

			{#if showActions}
				<ProductFormActions {isSubmitting} {submitText} onCancel={navigateToCancelHref} />
			{/if}
		</div>

		<div class="space-y-6">
			<ProductPricingSection
				{formData}
				{product}
				{pricingCopy}
				{hasCommercialReferences}
				{taxSummary}
			/>

			<ProductStockSection {formData} {showStockFields} {inventoryCopy} />

			<ProductImageSection {formData} {imagePreviewAvailable} {previewAlt} {imageError} />
		</div>
	</div>
</form>
