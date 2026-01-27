<script lang="ts">
	import { Button, Spinner, Select, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { createProductForm, updateProductForm } from '$lib/remote/products.remote';
	import { FormInput, FormTextarea } from '$lib/components/ui';
	import { scrollToFirstError } from '$lib/utils';
	import type { Product } from '$lib/server/db/schema';
	import {
		ProductType,
		ALL_PRODUCT_TYPES,
		PRODUCT_TYPE_LABELS,
		requiresStockTracking
	} from '$lib/shared/enums';

	interface Props {
		product?: Product | null;
		brands: { id: string; name: string }[];
		suppliers: { id: string; name: string }[];
		cancelHref?: string;
	}

	let { product = null, brands = [], suppliers = [], cancelHref = '/products' }: Props = $props();

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
		color: '',
		size: '',
		description: '',
		purchasePrice: 0,
		salePrice: 0,
		stock: 0,
		minStock: 0,
		imageUrl: ''
	});

	// Computed: show stock fields?
	const showStockFields = $derived(requiresStockTracking(formData.type as ProductType));

	// Computed: profit margin
	const profitMargin = $derived(() => {
		if (formData.purchasePrice === 0) return 0;
		return ((formData.salePrice - formData.purchasePrice) / formData.purchasePrice) * 100;
	});

	// Initialize form data
	let formInstanceId = $state(crypto.randomUUID());
	$effect(() => {
		untrack(() => {
			formInstanceId = crypto.randomUUID();
			if (product) {
				formData = {
					sku: product.sku ?? '',
					name: product.name ?? '',
					type: product.type ?? ProductType.FRAME,
					brandId: product.brandId ?? '',
					supplierId: product.supplierId ?? '',
					color: product.color ?? '',
					size: product.size ?? '',
					description: product.description ?? '',
					purchasePrice: product.purchasePrice ?? 0,
					salePrice: product.salePrice ?? 0,
					stock: product.stock ?? 0,
					minStock: product.minStock ?? 0,
					imageUrl: product.imageUrl ?? ''
				};
			}
		});
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
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`/products/${product?.id}`);
	}
</script>

<div class="mx-auto max-w-4xl">
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
					toast.error('Error actualizando producto');
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<input type="hidden" name="id" value={product.id} />

			<!-- Basic Info -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Información Básica</h3>
				<div class="grid gap-4 md:grid-cols-2">
					<FormInput
						label="SKU *"
						name="sku"
						required
						bind:value={formData.sku}
						placeholder="MT-23-C1"
						error={currentUpdateForm.fields.sku?.issues()}
					/>
					<FormInput
						label="Nombre *"
						name="name"
						required
						bind:value={formData.name}
						placeholder="Nombre del producto"
						error={currentUpdateForm.fields.name?.issues()}
					/>
				</div>

				<div class="mt-4 grid gap-4 md:grid-cols-3">
					<div>
						<Label for="type" class="mb-2">Tipo *</Label>
						<Select id="type" name="type" bind:value={formData.type} required>
							{#each ALL_PRODUCT_TYPES as t (t)}
								<option value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
							{/each}
						</Select>
					</div>
					<div>
						<Label for="brandId" class="mb-2">Marca</Label>
						<Select id="brandId" name="brandId" bind:value={formData.brandId}>
							<option value="">Sin marca</option>
							{#each brands as brand (brand.id)}
								<option value={brand.id}>{brand.name}</option>
							{/each}
						</Select>
					</div>
					<div>
						<Label for="supplierId" class="mb-2">Proveedor</Label>
						<Select id="supplierId" name="supplierId" bind:value={formData.supplierId}>
							<option value="">Sin proveedor</option>
							{#each suppliers as supplier (supplier.id)}
								<option value={supplier.id}>{supplier.name}</option>
							{/each}
						</Select>
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
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Precios</h3>
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<Label for="purchasePrice" class="mb-2">Precio compra ($) *</Label>
						<input
							type="number"
							id="purchasePrice"
							name="purchasePrice"
							bind:value={formData.purchasePrice}
							step="0.01"
							min="0"
							required
							class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
						/>
					</div>
					<div>
						<Label for="salePrice" class="mb-2">Precio venta ($) *</Label>
						<input
							type="number"
							id="salePrice"
							name="salePrice"
							bind:value={formData.salePrice}
							step="0.01"
							min="0"
							required
							class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
						/>
						{#if formData.purchasePrice > 0}
							<p class="mt-1 text-sm text-slate-500">
								Margen: <span class:text-green-600={profitMargin() > 0}
									>{profitMargin().toFixed(1)}%</span
								>
							</p>
						{/if}
					</div>
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

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<Button color="alternative" href={cancelHref} disabled={isSubmitting}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
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
					toast.error('Error creando producto');
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<!-- Basic Info -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Información Básica</h3>
				<div class="grid gap-4 md:grid-cols-2">
					<FormInput
						label="SKU *"
						name="sku"
						required
						bind:value={formData.sku}
						placeholder="MT-23-C1"
						error={currentCreateForm.fields.sku?.issues()}
					/>
					<FormInput
						label="Nombre *"
						name="name"
						required
						bind:value={formData.name}
						placeholder="Nombre del producto"
						error={currentCreateForm.fields.name?.issues()}
					/>
				</div>

				<div class="mt-4 grid gap-4 md:grid-cols-3">
					<div>
						<Label for="type" class="mb-2">Tipo *</Label>
						<Select id="type" name="type" bind:value={formData.type} required>
							{#each ALL_PRODUCT_TYPES as t (t)}
								<option value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
							{/each}
						</Select>
					</div>
					<div>
						<Label for="brandId" class="mb-2">Marca</Label>
						<Select id="brandId" name="brandId" bind:value={formData.brandId}>
							<option value="">Sin marca</option>
							{#each brands as brand (brand.id)}
								<option value={brand.id}>{brand.name}</option>
							{/each}
						</Select>
					</div>
					<div>
						<Label for="supplierId" class="mb-2">Proveedor</Label>
						<Select id="supplierId" name="supplierId" bind:value={formData.supplierId}>
							<option value="">Sin proveedor</option>
							{#each suppliers as supplier (supplier.id)}
								<option value={supplier.id}>{supplier.name}</option>
							{/each}
						</Select>
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
				<h3 class="mb-4 text-lg font-semibold text-slate-800">Precios</h3>
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<Label for="purchasePrice" class="mb-2">Precio compra ($) *</Label>
						<input
							type="number"
							id="purchasePrice"
							name="purchasePrice"
							bind:value={formData.purchasePrice}
							step="0.01"
							min="0"
							required
							class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
						/>
					</div>
					<div>
						<Label for="salePrice" class="mb-2">Precio venta ($) *</Label>
						<input
							type="number"
							id="salePrice"
							name="salePrice"
							bind:value={formData.salePrice}
							step="0.01"
							min="0"
							required
							class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
						/>
						{#if formData.purchasePrice > 0}
							<p class="mt-1 text-sm text-slate-500">
								Margen: <span class:text-green-600={profitMargin() > 0}
									>{profitMargin().toFixed(1)}%</span
								>
							</p>
						{/if}
					</div>
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

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<Button color="alternative" href={cancelHref} disabled={isSubmitting}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{/if}
</div>
