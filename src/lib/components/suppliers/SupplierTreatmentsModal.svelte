<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Plus, FlaskConical } from '@lucide/svelte';
	import TreatmentRow from './treatments/TreatmentRow.svelte';
	import TreatmentEditForm from './treatments/TreatmentEditForm.svelte';
	import TreatmentCreateForm from './treatments/TreatmentCreateForm.svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import {
		listSupplierTreatments,
		createSupplierTreatmentForm,
		updateSupplierTreatmentForm,
		deleteSupplierTreatmentById
	} from '$lib/remote/suppliers.remote';
	import { getErrorMessage, generateUUID, toastUnboundErrors } from '$lib/utils';
	import { ConfirmModal } from '$lib/components/ui';
	import type { Supplier, SupplierTreatment } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		supplier: Supplier | null;
		canManage?: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), supplier, canManage = true, onClose }: Props = $props();

	// Data
	let treatments = $state<SupplierTreatment[]>([]);
	let loading = $state(false);

	// Create form state
	let showCreateForm = $state(false);
	let createInstanceId = $state(generateUUID());
	let createTaxable = $state(false);
	const currentCreateForm = $derived(createSupplierTreatmentForm.for(createInstanceId));

	// Edit state
	let editingId = $state<string | null>(null);
	let editInstanceId = $state(generateUUID());
	let editTaxable = $state(false);
	const currentEditForm = $derived(updateSupplierTreatmentForm.for(editInstanceId));

	// Delete state
	let showDeleteModal = $state(false);
	let deletingTreatment = $state<SupplierTreatment | null>(null);
	let deleteLoading = $state(false);

	// Load treatments when modal opens
	$effect(() => {
		if (open && supplier) {
			untrack(() => {
				loadTreatments();
				showCreateForm = false;
				editingId = null;
			});
		}
	});

	async function loadTreatments({ imperative = false }: { imperative?: boolean } = {}) {
		if (!supplier) return;
		loading = true;
		try {
			const treatmentsQuery = listSupplierTreatments({ supplierId: supplier.id });
			treatments = imperative ? await treatmentsQuery : await treatmentsQuery;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando tratamientos'));
		} finally {
			loading = false;
		}
	}

	// Create handlers
	function openCreate() {
		if (!canManage) return;

		createInstanceId = generateUUID();
		createTaxable = false;
		showCreateForm = true;
		editingId = null;
	}

	function cancelCreate() {
		showCreateForm = false;
	}

	async function handleCreateResult() {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Tratamiento creado');
		showCreateForm = false;
		await loadTreatments({ imperative: true });
	}

	// Edit handlers
	function startEdit(treatment: SupplierTreatment) {
		if (!canManage) return;

		editInstanceId = generateUUID();
		editingId = treatment.id;
		editTaxable = treatment.isTaxable;
		showCreateForm = false;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleEditResult() {
		const allIssues = currentEditForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Tratamiento actualizado');
		editingId = null;
		await loadTreatments({ imperative: true });
	}

	// Delete handlers
	function openDelete(treatment: SupplierTreatment) {
		if (!canManage) return;

		deletingTreatment = treatment;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!deletingTreatment) return;
		deleteLoading = true;
		try {
			await deleteSupplierTreatmentById({ id: deletingTreatment.id });
			toast.success('Tratamiento eliminado');
			showDeleteModal = false;
			deletingTreatment = null;
			await loadTreatments({ imperative: true });
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando tratamiento'));
		} finally {
			deleteLoading = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root
	bind:open
	onOpenChangeComplete={(o) => {
		if (!o) handleClose();
	}}
>
	<Dialog.Content class="sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Tratamientos - {supplier?.name ?? ''}</Dialog.Title>
		</Dialog.Header>
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
					><circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/><path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/></svg
				>
			</div>
		{:else}
			<div class="space-y-4">
				<!-- Treatment list -->
				{#if treatments.length === 0 && !showCreateForm}
					<div
						class="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center"
					>
						<FlaskConical class="mx-auto mb-3 h-8 w-8 text-slate-400" />
						<p class="text-sm font-medium text-slate-600">No hay tratamientos registrados</p>
						<p class="mt-1 text-xs text-slate-400">
							{canManage
								? 'Agrega tratamientos que este laboratorio ofrece'
								: 'Este proveedor no tiene tratamientos registrados'}
						</p>
					</div>
				{:else}
					<div class="divide-y divide-slate-100 rounded-lg border border-slate-200">
						{#each treatments as treatment (treatment.id)}
							{#if canManage && editingId === treatment.id}
								<TreatmentEditForm
									{treatment}
									form={currentEditForm}
									taxable={editTaxable}
									onToggleTaxable={() => (editTaxable = !editTaxable)}
									onCancel={cancelEdit}
									onResult={handleEditResult}
								/>
							{:else}
								<TreatmentRow {treatment} {canManage} onEdit={startEdit} onDelete={openDelete} />
							{/if}
						{/each}
					</div>
				{/if}

				{#if canManage && showCreateForm && supplier}
					<TreatmentCreateForm
						supplierId={supplier.id}
						form={currentCreateForm}
						taxable={createTaxable}
						onToggleTaxable={() => (createTaxable = !createTaxable)}
						onCancel={cancelCreate}
						onResult={handleCreateResult}
					/>
				{/if}
			</div>
		{/if}

		<Dialog.Footer class="flex w-full items-center {canManage ? 'justify-between' : 'justify-end'}">
			{#if canManage && !showCreateForm && !loading}
				<Button size="sm" variant="outline" onclick={openCreate}>
					<Plus class="mr-1.5 h-4 w-4" />
					Agregar Tratamiento
				</Button>
			{:else if canManage}
				<div></div>
			{/if}
			<Button size="sm" variant="outline" onclick={handleClose}>Cerrar</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete confirmation -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Tratamiento"
	message="¿Eliminar el tratamiento «{deletingTreatment?.name}»? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
