<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import LensDetailBadges from '$lib/components/lenses/detail/LensDetailBadges.svelte';
	import LensDetailTechnicalPanel from '$lib/components/lenses/detail/LensDetailTechnicalPanel.svelte';
	import LensDetailOpticalPanel from '$lib/components/lenses/detail/LensDetailOpticalPanel.svelte';
	import LensDetailSidebar from '$lib/components/lenses/detail/LensDetailSidebar.svelte';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { isAdminRole } from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { item } = untrack(() => data);

	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let showHistoryModal = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	const relatedNames = $derived({
		...(item.supplier ? { [item.supplier.id]: item.supplier.name } : {}),
		...(item.material ? { [item.material.id]: item.material.name } : {})
	});

	function openEdit() {
		goto(resolve(`/lenses/${item.id}/edit`));
	}

	async function confirmDelete() {
		deleteLoading = true;
		try {
			await deleteLensCatalogItemById({ id: item.id });
			toast.success('Lente eliminado correctamente');
			goto(resolve('/lenses'));
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando lente'));
		} finally {
			deleteLoading = false;
			showDeleteModal = false;
		}
	}
</script>

<svelte:head>
	<title>{item.name} - Catálogo de Lentes - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader
		title={item.name}
		subtitle="Detalle de lente"
		backLabel="Volver al catálogo"
		backHref="/lenses"
	>
		{#snippet actions()}
			{#if isAdmin}
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={() => (showDeleteModal = true)}
						class="inline-flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-xs font-bold tracking-[0.18em] text-on-error-container uppercase transition-colors hover:brightness-[0.98]"
					>
						<Trash2 class="h-4 w-4" />
						Eliminar
					</button>
					<button
						type="button"
						onclick={openEdit}
						class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-xs font-bold tracking-[0.18em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
					>
						<Pencil class="h-4 w-4" />
						Editar lente
					</button>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	<LensDetailBadges {item} />

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
		<div class="space-y-6">
			<LensDetailTechnicalPanel {item} />
			<LensDetailOpticalPanel {item} />
		</div>
		<LensDetailSidebar {item} onOpenHistory={() => (showHistoryModal = true)} />
	</div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Lente"
	message="¿Estás seguro de que deseas eliminar este lente del catálogo? Esta acción puede ser revertida."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={confirmDelete}
	onCancel={() => (showDeleteModal = false)}
/>

<!-- History Modal -->
<ChangeHistoryModal
	bind:open={showHistoryModal}
	title={item.name}
	entityType="lens_catalog_item"
	entityId={item.id}
	{relatedNames}
/>
