<script lang="ts">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Spinner
	} from 'flowbite-svelte';
	import { SquarePen, Trash2, Tag } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteBrandById } from '$lib/remote/brands.remote';
	import { getErrorMessage } from '$lib/utils';
	import { ConfirmModal } from '$lib/components/ui';
	import type { Brand } from '$lib/server/db/schema';

	interface Props {
		brands: Brand[];
		loading?: boolean;
		onEdit: (brand: Brand) => void;
		onRefresh?: () => void;
	}

	let { brands, loading = false, onEdit, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let selectedBrand = $state<Brand | null>(null);
	let deleteLoading = $state(false);

	function openDelete(brand: Brand) {
		selectedBrand = brand;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedBrand) return;

		deleteLoading = true;
		try {
			await deleteBrandById({ id: selectedBrand.id });
			toast.success('Marca eliminada exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando marca'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Spinner size="10" />
	</div>
{:else if brands.length > 0}
	<Table hoverable striped shadow>
		<TableHead>
			<TableHeadCell>Nombre</TableHeadCell>
			<TableHeadCell>País</TableHeadCell>
			<TableHeadCell>Sitio Web</TableHeadCell>
			<TableHeadCell>Acciones</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each brands as brand (brand.id)}
				<TableBodyRow>
					<TableBodyCell class="font-medium">{brand.name}</TableBodyCell>
					<TableBodyCell>{brand.country ?? '—'}</TableBodyCell>
					<TableBodyCell>
						{#if brand.website}
							<a
								href={brand.website}
								target="_blank"
								rel="noopener noreferrer external"
								class="text-primary-600 hover:underline"
							>
								{brand.website}
							</a>
						{:else}
							—
						{/if}
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-1">
							<button
								onclick={() => onEdit(brand)}
								class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-blue-50 hover:text-blue-600"
								title="Editar"
							>
								<SquarePen class="h-4 w-4" />
							</button>
							<button
								onclick={() => openDelete(brand)}
								class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
								title="Eliminar"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
{:else}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center"
	>
		<Tag class="mb-3 h-10 w-10 text-slate-400" />
		<p class="text-sm font-medium text-slate-600">No se encontraron marcas</p>
		<p class="mt-1 text-xs text-slate-400">Agrega una marca para comenzar</p>
	</div>
{/if}

<!-- Delete Confirm Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Marca"
	message="¿Está seguro que desea eliminar la marca {selectedBrand?.name}? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
