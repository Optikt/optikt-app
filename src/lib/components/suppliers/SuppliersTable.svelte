<script lang="ts">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Spinner,
		Badge
	} from 'flowbite-svelte';
	import { SquarePen, Trash2, Truck } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteSupplierById } from '$lib/remote/suppliers.remote';
	import { getErrorMessage } from '$lib/utils';
	import { ConfirmModal } from '$lib/components/ui';
	import { SupplierType, SUPPLIER_TYPE_LABELS } from '$lib/shared/enums';
	import type { Supplier } from '$lib/server/db/schema';

	interface Props {
		suppliers: Supplier[];
		loading?: boolean;
		onEdit: (supplier: Supplier) => void;
		onRefresh?: () => void;
	}

	let { suppliers, loading = false, onEdit, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let selectedSupplier = $state<Supplier | null>(null);
	let deleteLoading = $state(false);

	function openDelete(supplier: Supplier) {
		selectedSupplier = supplier;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedSupplier) return;

		deleteLoading = true;
		try {
			await deleteSupplierById({ id: selectedSupplier.id });
			toast.success('Proveedor eliminado exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando proveedor'));
		} finally {
			deleteLoading = false;
		}
	}

	function getTypeBadgeColor(type: string): 'blue' | 'green' | 'purple' {
		switch (type) {
			case SupplierType.DISTRIBUTOR:
				return 'blue';
			case SupplierType.LABORATORY:
				return 'green';
			case SupplierType.BOTH:
				return 'purple';
			default:
				return 'blue';
		}
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Spinner size="10" />
	</div>
{:else if suppliers.length > 0}
	<Table hoverable striped shadow>
		<TableHead>
			<TableHeadCell>Nombre</TableHeadCell>
			<TableHeadCell>Tipo</TableHeadCell>
			<TableHeadCell>RIF</TableHeadCell>
			<TableHeadCell>Teléfono</TableHeadCell>
			<TableHeadCell>Contacto</TableHeadCell>
			<TableHeadCell>Acciones</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each suppliers as supplier (supplier.id)}
				<TableBodyRow>
					<TableBodyCell class="font-medium">{supplier.name}</TableBodyCell>
					<TableBodyCell>
						<Badge color={getTypeBadgeColor(supplier.type)}>
							{SUPPLIER_TYPE_LABELS[supplier.type as SupplierType] ?? supplier.type}
						</Badge>
					</TableBodyCell>
					<TableBodyCell>
						<span class="font-mono text-sm text-slate-600">{supplier.rif ?? '—'}</span>
					</TableBodyCell>
					<TableBodyCell>{supplier.primaryPhone}</TableBodyCell>
					<TableBodyCell>
						{#if supplier.contactName}
							<span>{supplier.contactName}</span>
							{#if supplier.contactRole}
								<span class="text-xs text-slate-500"> ({supplier.contactRole})</span>
							{/if}
						{:else}
							—
						{/if}
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-1">
							<button
								onclick={() => onEdit(supplier)}
								class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-blue-50 hover:text-blue-600"
								title="Editar"
							>
								<SquarePen class="h-4 w-4" />
							</button>
							<button
								onclick={() => openDelete(supplier)}
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
		<Truck class="mb-3 h-10 w-10 text-slate-400" />
		<p class="text-sm font-medium text-slate-600">No se encontraron proveedores</p>
		<p class="mt-1 text-xs text-slate-400">Agrega un proveedor para comenzar</p>
	</div>
{/if}

<!-- Delete Confirm Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Proveedor"
	message="¿Está seguro que desea eliminar el proveedor {selectedSupplier?.name}? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
