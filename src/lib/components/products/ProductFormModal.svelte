<script lang="ts">
	import { Modal, Button, Spinner, Select, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
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
		open: boolean;
		product?: Product | null;
		brands: { id: string; name: string }[];
		suppliers: { id: string; name: string }[];
		onSuccess?: () => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		product = null,
		brands = [],
		suppliers = [],
		onSuccess,
		onClose
	}: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!product);
	const title = $derived(isEditMode ? 'Editar Producto' : 'Agregar Producto');
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

	// Reset form when modal opens
	let formInstanceId = $state(crypto.randomUUID());
	$effect(() => {
		if (open) {
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
				} else {
					formData = {
						sku: '',
						name: '',
						type: ProductType.FRAME,
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
					};
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createProductForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateProductForm.for(`${product?.id ?? 'new'}-${formInstanceId}`)
	);

	function handleClose() {
		open = false;
		onClose();
	}

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}

		toast.success('Producto creado exitosamente');
		formEl.reset();
		open = false;
		onSuccess?.();
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
		open = false;
		onSuccess?.();
	}
</script>

<Modal bind:open size="lg" {title} outsideclose={false}>
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
			class="space-y-4"
		>
			<input type="hidden" name="id" value={product.id} />

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

			<div class="grid gap-4 md:grid-cols-3">
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

			<div class="grid gap-4 md:grid-cols-2">
				<FormInput
					label="Color"
					name="color"
					bind:value={formData.color}
					placeholder="Negro, Dorado"
				/>
				<FormInput label="Tamaño" name="size" bind:value={formData.size} placeholder="52-18-140" />
			</div>

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

			{#if showStockFields}
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
						<Label for="minStock" class="mb-2">Stock mínimo</Label>
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
			{/if}

			<FormTextarea
				label="Descripción"
				name="description"
				bind:value={formData.description}
				placeholder="Descripción del producto..."
				rows={3}
			/>

			<FormInput
				label="URL de imagen"
				name="imageUrl"
				bind:value={formData.imageUrl}
				placeholder="https://..."
			/>

			<div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
				<Button color="alternative" onclick={handleClose} disabled={isSubmitting}>Cancelar</Button>
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
			class="space-y-4"
		>
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

			<div class="grid gap-4 md:grid-cols-3">
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

			<div class="grid gap-4 md:grid-cols-2">
				<FormInput
					label="Color"
					name="color"
					bind:value={formData.color}
					placeholder="Negro, Dorado"
				/>
				<FormInput label="Tamaño" name="size" bind:value={formData.size} placeholder="52-18-140" />
			</div>

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

			{#if showStockFields}
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
						<Label for="minStock" class="mb-2">Stock mínimo</Label>
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
			{/if}

			<FormTextarea
				label="Descripción"
				name="description"
				bind:value={formData.description}
				placeholder="Descripción del producto..."
				rows={3}
			/>

			<FormInput
				label="URL de imagen"
				name="imageUrl"
				bind:value={formData.imageUrl}
				placeholder="https://..."
			/>

			<div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
				<Button color="alternative" onclick={handleClose} disabled={isSubmitting}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{/if}
</Modal>
