<script lang="ts">
	import { Modal, Button } from 'flowbite-svelte';
	import { Globe, FileText, MapPin, Plus, Truck, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		addSupplierToBrand,
		listSupplierRelationOptions,
		listSuppliersForBrand,
		removeSupplierFromBrand
	} from '$lib/remote/brands.remote';
	import BrandIncludedAccessoriesSection from '$lib/components/brands/BrandIncludedAccessoriesSection.svelte';
	import type { Brand } from '$lib/server/db/schema';
	import { getErrorMessage } from '$lib/utils';
	import { getAvailableRelationOptions } from '$lib/utils/brandSupplierRelations';

	type RelatedSupplier = {
		id: string;
		name: string;
	};

	interface Props {
		open: boolean;
		brand: Brand | null;
		canManageRelations?: boolean;
		onClose: () => void;
		onEdit?: () => void;
	}

	let { open = $bindable(), brand, canManageRelations = false, onClose, onEdit }: Props = $props();
	let relatedSuppliers = $state<RelatedSupplier[]>([]);
	let supplierOptions = $state<RelatedSupplier[]>([]);
	let loadingRelations = $state(false);
	let loadingSupplierOptions = $state(false);
	let savingRelation = $state(false);
	let relationsError = $state<string | null>(null);
	let editingRelations = $state(false);
	let selectedSupplierId = $state('');
	let relationRequestId = 0;

	const availableSuppliers = $derived(
		getAvailableRelationOptions(supplierOptions, relatedSuppliers)
	);

	function handleClose() {
		editingRelations = false;
		selectedSupplierId = '';
		open = false;
		onClose();
	}

	function handleEdit() {
		open = false;
		onEdit?.();
	}

	async function loadRelatedSuppliers(
		brandId: string,
		{ imperative = false }: { imperative?: boolean } = {}
	) {
		const requestId = ++relationRequestId;
		loadingRelations = true;
		relationsError = null;

		try {
			const suppliersQuery = listSuppliersForBrand({ id: brandId });
			const suppliers = imperative ? await suppliersQuery.run() : await suppliersQuery;
			if (requestId !== relationRequestId) return;
			relatedSuppliers = suppliers;
		} catch (error) {
			console.error(error);
			if (requestId !== relationRequestId) return;
			relatedSuppliers = [];
			relationsError = 'No se pudieron cargar los proveedores relacionados.';
			toast.error(getErrorMessage(error, 'Error cargando proveedores relacionados'));
		} finally {
			if (requestId === relationRequestId) {
				loadingRelations = false;
			}
		}
	}

	async function loadSupplierOptions() {
		loadingSupplierOptions = true;
		try {
			supplierOptions = await listSupplierRelationOptions({}).run();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando proveedores disponibles'));
		} finally {
			loadingSupplierOptions = false;
		}
	}

	async function startRelationEditing() {
		if (!canManageRelations) return;
		editingRelations = true;
		await loadSupplierOptions();
	}

	function stopRelationEditing() {
		editingRelations = false;
		selectedSupplierId = '';
	}

	async function handleAddSupplier() {
		if (!brand || !selectedSupplierId) return;

		savingRelation = true;
		try {
			await addSupplierToBrand({ brandId: brand.id, supplierId: selectedSupplierId });
			selectedSupplierId = '';
			await loadRelatedSuppliers(brand.id, { imperative: true });
			toast.success('Proveedor agregado a la marca');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error agregando proveedor a la marca'));
		} finally {
			savingRelation = false;
		}
	}

	async function handleRemoveSupplier(supplier: RelatedSupplier) {
		if (!brand) return;

		savingRelation = true;
		try {
			await removeSupplierFromBrand({ brandId: brand.id, supplierId: supplier.id });
			await loadRelatedSuppliers(brand.id, { imperative: true });
			toast.success('Proveedor removido de la marca');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error removiendo proveedor de la marca'));
		} finally {
			savingRelation = false;
		}
	}

	$effect(() => {
		const brandId = brand?.id;

		if (!open || !brandId) {
			relatedSuppliers = [];
			supplierOptions = [];
			relationsError = null;
			loadingRelations = false;
			loadingSupplierOptions = false;
			savingRelation = false;
			editingRelations = false;
			selectedSupplierId = '';
			return;
		}

		void loadRelatedSuppliers(brandId);
	});
</script>

<Modal bind:open size="md" title="Detalles de la Marca" outsideclose onclose={handleClose}>
	{#if brand}
		<div class="space-y-6">
			<!-- Header with name -->
			<div class="border-b border-slate-200 pb-4">
				<h3 class="text-xl font-semibold text-slate-800">{brand.name}</h3>
				{#if brand.country}
					<div class="mt-2 flex items-center gap-2 text-sm text-slate-500">
						<MapPin class="h-4 w-4" />
						{brand.country}
					</div>
				{/if}
			</div>

			<!-- Website -->
			{#if brand.website}
				<div class="flex items-center gap-3">
					<Globe class="h-4 w-4 text-slate-400" />
					<a
						href={brand.website}
						target="_blank"
						rel="external noopener"
						class="text-sm text-primary-600 hover:underline"
					>
						{brand.website}
					</a>
				</div>
			{/if}

			<!-- Description -->
			{#if brand.description}
				<div class="border-t border-slate-200 pt-4">
					<h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
						<FileText class="h-4 w-4" />
						Descripción
					</h4>
					<p class="text-sm whitespace-pre-wrap text-slate-700">{brand.description}</p>
				</div>
			{/if}

			<div class="border-t border-slate-200 pt-4">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h4 class="flex items-center gap-2 text-sm font-medium text-slate-600">
						<Truck class="h-4 w-4" />
						Proveedores que la venden
					</h4>
					{#if canManageRelations}
						<button
							type="button"
							onclick={editingRelations ? stopRelationEditing : startRelationEditing}
							class="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10"
						>
							{editingRelations ? 'Listo' : 'Editar'}
						</button>
					{/if}
				</div>

				{#if editingRelations}
					<div class="mb-4 flex flex-col gap-2 sm:flex-row">
						<select
							bind:value={selectedSupplierId}
							disabled={loadingSupplierOptions || savingRelation || availableSuppliers.length === 0}
							class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						>
							<option value="">
								{loadingSupplierOptions
									? 'Cargando proveedores...'
									: availableSuppliers.length === 0
										? 'No hay proveedores disponibles'
										: 'Agregar proveedor...'}
							</option>
							{#each availableSuppliers as supplier (supplier.id)}
								<option value={supplier.id}>{supplier.name}</option>
							{/each}
						</select>
						<button
							type="button"
							onclick={handleAddSupplier}
							disabled={!selectedSupplierId || savingRelation}
							class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
						>
							<Plus class="h-4 w-4" />
							Agregar
						</button>
					</div>
				{/if}

				{#if loadingRelations}
					<p class="text-sm text-slate-500">Cargando proveedores relacionados...</p>
				{:else if relationsError}
					<p class="text-sm text-red-600">{relationsError}</p>
				{:else if relatedSuppliers.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each relatedSuppliers as supplier (supplier.id)}
							<span
								class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
							>
								{supplier.name}
								{#if editingRelations}
									<button
										type="button"
										onclick={() => handleRemoveSupplier(supplier)}
										disabled={savingRelation}
										aria-label={`Quitar proveedor ${supplier.name}`}
										class="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<X class="h-3 w-3" />
									</button>
								{/if}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-slate-500 italic">
						Aún no hay proveedores registrados para esta marca.
					</p>
				{/if}
			</div>

			<BrandIncludedAccessoriesSection {brand} canManage={canManageRelations} />
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex w-full justify-end gap-3">
			<Button color="alternative" onclick={handleClose}>Cerrar</Button>
			{#if onEdit}
				<Button color="primary" onclick={handleEdit}>Editar</Button>
			{/if}
		</div>
	{/snippet}
</Modal>
