<script lang="ts">
	import { Select, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { createProductForm, updateProductForm } from '$lib/remote/products.remote';
	import {
		FormInput,
		FormTextarea,
		CreatableSelect,
		PurchaseCurrencyInput,
		type SelectOption,
		type PendingEntity
	} from '$lib/components/ui';
	import { scrollToFirstError } from '$lib/utils';
	import {
		ProductType,
		ALL_PRODUCT_TYPES,
		PRODUCT_TYPE_LABELS,
		requiresStockTracking,
		CurrencyCode
	} from '$lib/shared/enums';
	import { generateSku, ProductGender, PRODUCT_GENDER_LABELS } from '$lib/utils/sku';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { Checkbox } from 'flowbite-svelte';
	import type { Product } from '$lib/server/db/schema';
	import FormActions from '$lib/components/ui/FormActions.svelte';
	import { resolve } from '$app/paths';

	interface MaterialOption extends SelectOption {
		productType?: string;
	}

	interface Props {
		product?: Product | null;
		brands: { id: string; name: string }[];
		suppliers: { id: string; name: string }[];
		materials: { id: string; name: string; productType?: string }[];
		cancelHref?: string;
	}

	let {
		product = null,
		brands = [],
		suppliers = [],
		materials = [],
		cancelHref = '/products'
	}: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!product);
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Producto');

	// Form data
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
		purchasePrice: 0,
		salePrice: 0,
		// Currency fields
		purchaseCurrency: CurrencyCode.USD_BCV,
		purchaseCurrencyRate: 0,
		purchaseUsdBcvRate: 0,
		purchaseDate: new Date().toISOString().split('T')[0],
		stock: 0,
		minStock: 0,
		imageUrl: ''
	});

	let isAutoSku = $state(true);

	// ============================================================================
	// PENDING ITEMS (DEFERRED CREATION)
	// These track new items typed by the user that will be created on form submit
	// ============================================================================

	let pendingBrands = $state<PendingEntity[]>([]);
	let pendingSuppliers = $state<PendingEntity[]>([]);
	let pendingMaterials = $state<PendingEntity[]>([]);
	const pendingModels: PendingEntity[] = [];

	// Merged options: original + pending
	const allBrands = $derived<SelectOption[]>([
		...brands,
		...pendingBrands.map((p) => ({ id: p.pendingId, name: p.name, isPending: true }))
	]);

	const allSuppliers = $derived<SelectOption[]>([
		...suppliers,
		...pendingSuppliers.map((p) => ({ id: p.pendingId, name: p.name, isPending: true }))
	]);

	// Materials filtered by current product type
	const allMaterials = $derived.by<MaterialOption[]>(() => {
		const type = formData.type;
		// Map materials to include pending status
		const baseMaterials = materials
			.filter((m) => {
				// Show materials that match the product type
				// For SUNGLASSES, also show FRAME materials since they share materials
				const materialType = m.productType;
				if (type === ProductType.SUNGLASSES) {
					return materialType === 'FRAME' || materialType === 'SUNGLASSES';
				}
				return materialType === type;
			})
			.map((m) => ({ ...m, isPending: false }));

		// Add pending materials for this product type
		const pendingForType = pendingMaterials
			.filter((p) => p.productType === type)
			.map((p) => ({
				id: p.pendingId,
				name: p.name,
				isPending: true,
				productType: typeof p.productType === 'string' ? p.productType : undefined
			}));

		return [...baseMaterials, ...pendingForType];
	});

	// Handlers for creating pending items (no DB call yet!)
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
		const productType = formData.type; // Associate with current product type
		pendingMaterials = [...pendingMaterials, { pendingId, name, productType }];
		return { id: pendingId, name, isPending: true };
	}

	/**
	 * Helper functions to get pending entity names by ID
	 * Used to send pending names to backend via hidden inputs
	 */
	function getPendingName(pendingId: string): string | null {
		if (!pendingId.startsWith('pending_')) return null;

		const brand = pendingBrands.find((b) => b.pendingId === pendingId);
		if (brand) return brand.name;

		const supplier = pendingSuppliers.find((s) => s.pendingId === pendingId);
		if (supplier) return supplier.name;

		const material = pendingMaterials.find((m) => m.pendingId === pendingId);
		if (material) return material.name;

		const model = pendingModels.find((m) => m.pendingId === pendingId);
		if (model) return model.name;

		return null;
	}

	function getPendingMaterialCategory(pendingId: string): string | null {
		if (!pendingId.startsWith('pending_material_')) return null;
		const material = pendingMaterials.find((m) => m.pendingId === pendingId);
		return typeof material?.productType === 'string' ? material.productType : null;
	}

	// Clear material when product type changes (since materials are type-specific)
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		formData.type; // Track type changes
		untrack(() => {
			// Only clear if current material doesn't match new type
			const currentMaterial = allMaterials.find((m) => m.id === formData.materialId);
			if (currentMaterial && currentMaterial.productType) {
				const type = formData.type;
				const materialType = currentMaterial.productType;
				if (materialType !== 'ALL' && materialType !== type) {
					// For sunglasses, keep FRAME materials
					if (!(type === ProductType.SUNGLASSES && materialType === 'FRAME')) {
						formData.materialId = '';
					}
				}
			}
		});
	});

	// Computed: show stock fields?
	const showStockFields = $derived(requiresStockTracking(formData.type as ProductType));

	// Initialize form data
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		untrack(() => {
			formInstanceId = generateUUID();
			if (product) {
				isAutoSku = false; // Disable auto SKU when editing existing product
				formData = {
					sku: product.sku ?? '',
					name: product.name ?? '',
					type: product.type ?? ProductType.FRAME,
					brandId: product.brandId ?? '',
					supplierId: product.supplierId ?? '',
					materialId: product.materialId ?? '',
					gender: product.gender ?? ProductGender.NO_APLICA,
					personalCode: '',
					color: product.color ?? '',
					size: product.size ?? '',
					description: product.description ?? '',
					purchasePrice: product.purchasePrice ?? 0,
					salePrice: product.salePrice ?? 0,
					purchaseCurrency: (product.purchaseCurrency as CurrencyCode) ?? CurrencyCode.USD_BCV,
					purchaseCurrencyRate: product.purchaseCurrencyRate ?? 0,
					purchaseUsdBcvRate: product.purchaseUsdBcvRate ?? 0,
					purchaseDate: product.purchaseDate ?? new Date().toISOString().split('T')[0],
					stock: product.stock ?? 0,
					minStock: product.minStock ?? 0,
					imageUrl: product.imageUrl ?? ''
				};
			}
		});
	});

	// Reactive SKU generation
	$effect(() => {
		if (isAutoSku) {
			const brandName = allBrands.find((b) => b.id === formData.brandId)?.name;
			const materialName = allMaterials.find((m) => m.id === formData.materialId)?.name;

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

	// Form instances
	const currentCreateForm = $derived(createProductForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateProductForm.for(`${product?.id ?? 'new'}-${formInstanceId}`)
	);

	// Handle create result - navigate to products list since we can't get the ID from enhance
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}

		toast.success('Producto creado exitosamente');
		formEl.reset();
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/products');
	}

	// Handle update result
	function handleUpdateResult(formEl: HTMLFormElement) {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}

		toast.success('Producto actualizado');
		formEl.reset();
		goto(resolve(`/products/${product?.id}`));
	}
</script>

<div class="mx-auto max-w-4xl pb-24">
	{#if isEditMode && product}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (e) {
					console.error(e);
					toast.error(e instanceof Error ? e.message : 'Error actualizando producto');
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<input type="hidden" name="id" value={product.id} />

			<!-- Hidden inputs for pending entities (if IDs are pending_*) -->
			{#if formData.brandId?.startsWith('pending_')}
				<input
					type="hidden"
					name="pendingBrandName"
					value={getPendingName(formData.brandId) ?? ''}
				/>
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
					value={getPendingMaterialCategory(formData.materialId) ?? formData.type}
				/>
			{/if}

			<!-- Basic Info -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Información Básica</h3>
				<div class="grid gap-6">
					<!-- Row 1: Name and Gender -->
					<div class="grid gap-4 md:grid-cols-2">
						<FormInput
							label="Nombre *"
							name="name"
							required
							bind:value={formData.name}
							placeholder="Nombre del producto"
							error={currentUpdateForm.fields.name?.issues()}
						/>
						<div>
							<Label for="gender_u" class="mb-2">Género</Label>
							<Select id="gender_u" name="gender" bind:value={formData.gender}>
								{#each Object.entries(PRODUCT_GENDER_LABELS) as [value, label] (value)}
									<option {value}>{label}</option>
								{/each}
							</Select>
						</div>
					</div>

					<!-- SKU Section -->
					<div class="border-t border-slate-100 pt-4">
						<div class="mb-3 w-fit">
							<Checkbox bind:checked={isAutoSku}>Autogenerar SKU</Checkbox>
						</div>
						<div class="grid items-end gap-4 md:grid-cols-2">
							{#if isAutoSku}
								<FormInput
									label="Código Propio"
									name="personalCode"
									bind:value={formData.personalCode}
									placeholder="Ej: 1234"
								/>
								<div
									class="flex min-h-14 flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 p-2"
								>
									<span class="mb-1 text-[10px] leading-none font-bold text-slate-500 uppercase"
										>SKU Generado</span
									>
									<div class="no-scrollbar overflow-x-auto">
										<span
											class="font-mono text-sm font-semibold whitespace-nowrap text-blue-600 select-all"
										>
											{formData.sku || '(vacío)'}
										</span>
									</div>
									<input type="hidden" name="sku" value={formData.sku} />
									{#if currentUpdateForm.fields.sku?.issues()}
										<p class="mt-1 text-xs text-red-600">
											{currentUpdateForm.fields.sku.issues()}
										</p>
									{/if}
								</div>
							{:else}
								<FormInput
									label="SKU *"
									name="sku"
									required
									bind:value={formData.sku}
									placeholder="MT-23-C1"
									error={currentUpdateForm.fields.sku?.issues()}
								/>
							{/if}
						</div>
					</div>

					<!-- Other Metadata -->
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div>
							<Label for="type_u" class="mb-2">Tipo *</Label>
							<Select id="type_u" name="type" bind:value={formData.type} required>
								{#each ALL_PRODUCT_TYPES as t (t)}
									<option value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
								{/each}
							</Select>
						</div>
						<CreatableSelect
							label="Material"
							name="materialId"
							placeholder="Buscar material..."
							bind:value={formData.materialId}
							options={allMaterials}
							creatable
							onCreatePending={handleCreatePendingMaterial}
						/>
						<CreatableSelect
							label="Marca"
							name="brandId"
							placeholder="Buscar marca..."
							bind:value={formData.brandId}
							options={allBrands}
							creatable
							onCreatePending={handleCreatePendingBrand}
						/>
						<CreatableSelect
							label="Proveedor"
							name="supplierId"
							placeholder="Buscar proveedor..."
							bind:value={formData.supplierId}
							options={allSuppliers}
							creatable
							onCreatePending={handleCreatePendingSupplier}
						/>
					</div>
				</div>

				<!-- Physical Properties -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Características</h3>
					<div class="grid gap-4 md:grid-cols-2">
						<FormInput
							label="Color"
							name="color"
							bind:value={formData.color}
							placeholder="Negro, Dorado"
						/>
						<FormInput
							label="Tamaño"
							name="size"
							bind:value={formData.size}
							placeholder="52-18-140"
						/>
					</div>
					<div class="mt-4">
						<FormTextarea
							label="Descripción"
							name="description"
							bind:value={formData.description}
							placeholder="Descripción del producto..."
							rows={3}
						/>
					</div>
				</div>

				<!-- Pricing -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Precios y Moneda de Compra</h3>
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<Label for="purchasePrice_u" class="mb-2">Precio compra *</Label>
							<input
								type="number"
								id="purchasePrice_u"
								name="purchasePrice"
								bind:value={formData.purchasePrice}
								step="0.01"
								min="0"
								required
								class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm"
							/>
						</div>
						<div>
							<Label for="salePrice_u" class="mb-2">Precio venta (USD BCV) *</Label>
							<input
								type="number"
								id="salePrice_u"
								name="salePrice"
								bind:value={formData.salePrice}
								step="0.01"
								min="0"
								required
								class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm"
							/>
						</div>
					</div>

					<!-- Currency & Exchange Rate Section -->
					<div class="mt-6 border-t border-slate-100 pt-4">
						<PurchaseCurrencyInput
							bind:purchaseCurrency={formData.purchaseCurrency}
							bind:purchaseCurrencyRate={formData.purchaseCurrencyRate}
							bind:purchaseUsdBcvRate={formData.purchaseUsdBcvRate}
							bind:purchaseDate={formData.purchaseDate}
							purchasePrice={formData.purchasePrice}
							salePrice={formData.salePrice}
							idPrefix="u_"
						/>
					</div>
				</div>

				<!-- Stock -->
				{#if showStockFields}
					<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 class="mb-4 text-lg font-semibold text-slate-800">Inventario</h3>
						<div class="grid gap-4 md:grid-cols-2">
							<div>
								<Label for="stock" class="mb-2">Stock actual</Label>
								<input
									type="number"
									id="stock"
									name="stock"
									bind:value={formData.stock}
									min="0"
									class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
								/>
							</div>
							<div>
								<Label for="minStock" class="mb-2">Stock mínimo (alertas)</Label>
								<input
									type="number"
									id="minStock"
									name="minStock"
									bind:value={formData.minStock}
									min="0"
									class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
								/>
							</div>
						</div>
					</div>
				{/if}

				<!-- Image -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Imagen</h3>
					<FormInput
						label="URL de imagen"
						name="imageUrl"
						bind:value={formData.imageUrl}
						placeholder="https://..."
					/>
				</div>

				<!-- Actions (sticky inside form) -->
				<FormActions primaryLabel={submitText} {cancelHref} {isSubmitting} />
			</div>
		</form>
	{:else}
		<!-- CREATE FORM -->
		<form
			{...currentCreateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleCreateResult(formEl);
				} catch (e) {
					console.error(e);
					toast.error(e instanceof Error ? e.message : 'Error creando producto');
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<!-- Hidden inputs for pending entities (if IDs are pending_*) -->
			{#if formData.brandId?.startsWith('pending_')}
				<input
					type="hidden"
					name="pendingBrandName"
					value={getPendingName(formData.brandId) ?? ''}
				/>
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
					value={getPendingMaterialCategory(formData.materialId) ?? formData.type}
				/>
			{/if}

			<!-- Basic Info -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Información Básica</h3>
				<div class="grid gap-6">
					<!-- Row 1: Name and Gender -->
					<div class="grid gap-4 md:grid-cols-2">
						<FormInput
							label="Nombre *"
							name="name"
							required
							bind:value={formData.name}
							placeholder="Nombre del producto"
							error={currentCreateForm.fields.name?.issues()}
						/>
						<div>
							<Label for="gender_c" class="mb-2">Género</Label>
							<Select id="gender_c" name="gender" bind:value={formData.gender}>
								{#each Object.entries(PRODUCT_GENDER_LABELS) as [value, label] (value)}
									<option {value}>{label}</option>
								{/each}
							</Select>
						</div>
					</div>

					<!-- SKU Section -->
					<div class="border-t border-slate-100 pt-4">
						<div class="mb-3 w-fit">
							<Checkbox bind:checked={isAutoSku}>Autogenerar SKU</Checkbox>
						</div>
						<div class="grid items-end gap-4 md:grid-cols-2">
							{#if isAutoSku}
								<FormInput
									label="Código Propio"
									name="personalCode"
									bind:value={formData.personalCode}
									placeholder="Ej: 1234"
								/>
								<div
									class="flex min-h-14 flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 p-2"
								>
									<span class="mb-1 text-[10px] leading-none font-bold text-slate-500 uppercase"
										>SKU Generado</span
									>
									<div class="no-scrollbar overflow-x-auto">
										<span
											class="font-mono text-sm font-semibold whitespace-nowrap text-blue-600 select-all"
										>
											{formData.sku || '(vacío)'}
										</span>
									</div>
									<input type="hidden" name="sku" value={formData.sku} />
									{#if currentCreateForm.fields.sku?.issues()}
										<p class="mt-1 text-xs text-red-600">
											{currentCreateForm.fields.sku.issues()}
										</p>
									{/if}
								</div>
							{:else}
								<FormInput
									label="SKU *"
									name="sku"
									required
									bind:value={formData.sku}
									placeholder="MT-23-C1"
									error={currentCreateForm.fields.sku?.issues()}
								/>
							{/if}
						</div>
					</div>

					<!-- Other Metadata -->
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div>
							<Label for="type_c" class="mb-2">Tipo *</Label>
							<Select id="type_c" name="type" bind:value={formData.type} required>
								{#each ALL_PRODUCT_TYPES as t (t)}
									<option value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
								{/each}
							</Select>
						</div>
						<CreatableSelect
							label="Material"
							name="materialId"
							placeholder="Buscar material..."
							bind:value={formData.materialId}
							options={allMaterials}
							creatable
							onCreatePending={handleCreatePendingMaterial}
						/>
						<CreatableSelect
							label="Marca"
							name="brandId"
							placeholder="Buscar marca..."
							bind:value={formData.brandId}
							options={allBrands}
							creatable
							onCreatePending={handleCreatePendingBrand}
						/>
						<CreatableSelect
							label="Proveedor"
							name="supplierId"
							placeholder="Buscar proveedor..."
							bind:value={formData.supplierId}
							options={allSuppliers}
							creatable
							onCreatePending={handleCreatePendingSupplier}
						/>
					</div>
				</div>
			</div>

			<!-- Physical Properties -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Características</h3>
				<div class="grid gap-4 md:grid-cols-2">
					<FormInput
						label="Color"
						name="color"
						bind:value={formData.color}
						placeholder="Negro, Dorado"
					/>
					<FormInput
						label="Tamaño"
						name="size"
						bind:value={formData.size}
						placeholder="52-18-140"
					/>
				</div>
				<div class="mt-4">
					<FormTextarea
						label="Descripción"
						name="description"
						bind:value={formData.description}
						placeholder="Descripción del producto..."
						rows={3}
					/>
				</div>
			</div>

			<!-- Pricing -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Precios y Moneda de Compra</h3>
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<Label for="purchasePrice_c" class="mb-2">Precio compra *</Label>
						<input
							type="number"
							id="purchasePrice_c"
							name="purchasePrice"
							bind:value={formData.purchasePrice}
							step="0.01"
							min="0"
							required
							class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm"
						/>
					</div>
					<div>
						<Label for="salePrice_c" class="mb-2">Precio venta (USD BCV) *</Label>
						<input
							type="number"
							id="salePrice_c"
							name="salePrice"
							bind:value={formData.salePrice}
							step="0.01"
							min="0"
							required
							class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm"
						/>
					</div>
				</div>

				<!-- Currency & Exchange Rate Section -->
				<div class="mt-6 border-t border-slate-100 pt-4">
					<PurchaseCurrencyInput
						bind:purchaseCurrency={formData.purchaseCurrency}
						bind:purchaseCurrencyRate={formData.purchaseCurrencyRate}
						bind:purchaseUsdBcvRate={formData.purchaseUsdBcvRate}
						bind:purchaseDate={formData.purchaseDate}
						purchasePrice={formData.purchasePrice}
						salePrice={formData.salePrice}
						idPrefix="c_"
					/>
				</div>
			</div>

			<!-- Stock -->
			{#if showStockFields}
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Inventario</h3>
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<Label for="stock" class="mb-2">Stock actual</Label>
							<input
								type="number"
								id="stock"
								name="stock"
								bind:value={formData.stock}
								min="0"
								class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
							/>
						</div>
						<div>
							<Label for="minStock" class="mb-2">Stock mínimo (alertas)</Label>
							<input
								type="number"
								id="minStock"
								name="minStock"
								bind:value={formData.minStock}
								min="0"
								class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
							/>
						</div>
					</div>
				</div>
			{/if}

			<!-- Image -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Imagen</h3>
				<FormInput
					label="URL de imagen"
					name="imageUrl"
					bind:value={formData.imageUrl}
					placeholder="https://..."
				/>
			</div>

			<!-- Actions (sticky inside form) -->
			<FormActions primaryLabel={submitText} {cancelHref} {isSubmitting} />
		</form>
	{/if}
</div>
