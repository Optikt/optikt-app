<script lang="ts">
	import { Modal, Button, Select, Spinner } from 'flowbite-svelte';
	import { Plus, Pencil, Trash2, FlaskConical, X, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import {
		listSupplierTreatments,
		createSupplierTreatmentForm,
		updateSupplierTreatmentForm,
		deleteSupplierTreatmentById
	} from '$lib/remote/suppliers.remote';
	import {
		ALL_TREATMENT_CATEGORIES,
		TreatmentCategory,
		TREATMENT_CATEGORY_LABELS,
		getTreatmentCategoryLabel
	} from '$lib/shared/enums';
	import { getErrorMessage, formatPrice, generateUUID, toastUnboundErrors } from '$lib/utils';
	import { ConfirmModal } from '$lib/components/ui';
	import type { Supplier, SupplierTreatment } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		supplier: Supplier | null;
		onClose: () => void;
	}

	let { open = $bindable(), supplier, onClose }: Props = $props();

	// Data
	let treatments = $state<SupplierTreatment[]>([]);
	let loading = $state(false);

	// Create form state
	let showCreateForm = $state(false);
	let createInstanceId = $state(generateUUID());
	let createTaxable = $state(true);
	const currentCreateForm = $derived(createSupplierTreatmentForm.for(createInstanceId));

	// Edit state
	let editingId = $state<string | null>(null);
	let editInstanceId = $state(generateUUID());
	let editTaxable = $state(true);
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

	async function loadTreatments() {
		if (!supplier) return;
		loading = true;
		try {
			treatments = await listSupplierTreatments({ supplierId: supplier.id });
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando tratamientos'));
		} finally {
			loading = false;
		}
	}

	// Create handlers
	function openCreate() {
		createInstanceId = generateUUID();
		createTaxable = true;
		showCreateForm = true;
		editingId = null;
	}

	function cancelCreate() {
		showCreateForm = false;
	}

	function handleCreateResult() {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Tratamiento creado');
		showCreateForm = false;
		loadTreatments();
	}

	// Edit handlers
	function startEdit(treatment: SupplierTreatment) {
		editInstanceId = generateUUID();
		editingId = treatment.id;
		editTaxable = treatment.isTaxable;
		showCreateForm = false;
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleEditResult() {
		const allIssues = currentEditForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Tratamiento actualizado');
		editingId = null;
		loadTreatments();
	}

	// Delete handlers
	function openDelete(treatment: SupplierTreatment) {
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
			loadTreatments();
		} catch (e) {
			console.error(e);
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

<Modal
	bind:open
	size="lg"
	title="Tratamientos - {supplier?.name ?? ''}"
	outsideclose
	onclose={handleClose}
>
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Spinner size="8" />
		</div>
	{:else}
		<div class="space-y-4">
			<!-- Treatment list -->
			{#if treatments.length === 0 && !showCreateForm}
				<div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
					<FlaskConical class="mx-auto mb-3 h-8 w-8 text-slate-400" />
					<p class="text-sm font-medium text-slate-600">No hay tratamientos registrados</p>
					<p class="mt-1 text-xs text-slate-400">Agrega tratamientos que este laboratorio ofrece</p>
				</div>
			{:else}
				<div class="divide-y divide-slate-100 rounded-lg border border-slate-200">
					{#each treatments as treatment (treatment.id)}
						{#if editingId === treatment.id}
							<!-- Inline edit form -->
							<form
								{...currentEditForm.enhance(async ({ submit }) => {
									await submit();
									handleEditResult();
								})}
								class="space-y-3 bg-blue-50/50 p-3"
							>
								<input type="hidden" name="id" value={treatment.id} />
								<div class="flex items-center gap-3">
									<div class="flex-1">
										<input
											name="name"
											type="text"
											value={treatment.name}
											class="w-full rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
											placeholder="Nombre"
										/>
										{#if currentEditForm.fields.name?.issues()}
											<p class="mt-1 text-xs text-red-500">
												{currentEditForm.fields.name.issues()}
											</p>
										{/if}
									</div>
									<Select name="category" value={treatment.category} class="w-36 text-sm">
										{#each ALL_TREATMENT_CATEGORIES as cat (cat)}
											<option value={cat}>{TREATMENT_CATEGORY_LABELS[cat]}</option>
										{/each}
									</Select>
									<div class="flex gap-1">
										<Button type="submit" size="xs" color="blue" class="p-1.5">
											<Check class="h-3.5 w-3.5" />
										</Button>
										<Button
											type="button"
											size="xs"
											color="light"
											class="p-1.5"
											onclick={cancelEdit}
										>
											<X class="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
								<div class="flex items-center gap-3">
									<div class="w-28">
										<label
											for="edit-price-{treatment.id}"
											class="mb-1 block text-[11px] font-medium text-slate-500">Costo</label
										>
										<input
											id="edit-price-{treatment.id}"
											name="price"
											type="number"
											step="0.01"
											min="0"
											value={treatment.price}
											class="w-full rounded-md border-slate-300 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
											placeholder="0.00"
										/>
									</div>
									<div class="w-28">
										<label
											for="edit-salePrice-{treatment.id}"
											class="mb-1 block text-[11px] font-medium text-slate-500">Precio Venta</label
										>
										<input
											id="edit-salePrice-{treatment.id}"
											name="salePrice"
											type="number"
											step="0.01"
											min="0"
											value={treatment.salePrice ?? ''}
											class="w-full rounded-md border-slate-300 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
											placeholder="0.00"
										/>
									</div>
									<div class="flex items-center gap-2 pt-4">
										<input type="hidden" name="isTaxable" value={String(editTaxable)} />
										<button
											type="button"
											class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {editTaxable
												? 'bg-blue-600'
												: 'bg-slate-200'}"
											onclick={() => (editTaxable = !editTaxable)}
											role="switch"
											aria-checked={editTaxable}
											aria-label="IVA"
										>
											<span
												class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 {editTaxable
													? 'translate-x-4'
													: 'translate-x-0'}"
											></span>
										</button>
										<span class="text-xs text-slate-600">IVA</span>
									</div>
									{#if editTaxable}
										<div class="w-20">
											<label
												for="edit-taxRate-{treatment.id}"
												class="mb-1 block text-[11px] font-medium text-slate-500">Tasa %</label
											>
											<input
												id="edit-taxRate-{treatment.id}"
												name="taxRate"
												type="number"
												step="0.01"
												min="0"
												value={treatment.taxRate}
												class="w-full rounded-md border-slate-300 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
												placeholder="16"
											/>
										</div>
									{/if}
								</div>
							</form>
						{:else}
							<!-- Display row -->
							<div
								class="flex items-center gap-3 px-4 py-3 {!treatment.isActive ? 'opacity-50' : ''}"
							>
								<div class="flex-1">
									<span class="text-sm font-medium text-slate-800">{treatment.name}</span>
								</div>
								<span
									class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
									{treatment.category === TreatmentCategory.AR
										? 'bg-blue-100 text-blue-700'
										: 'bg-violet-100 text-violet-700'}"
								>
									{getTreatmentCategoryLabel(treatment.category)}
								</span>
								{#if treatment.isTaxable}
									<span
										class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
										>IVA {treatment.taxRate}%</span
									>
								{/if}
								<span class="text-right font-mono text-xs text-slate-400" title="Costo">
									{formatPrice(treatment.price)}
								</span>
								<span
									class="w-24 text-right font-mono text-sm font-medium text-slate-700"
									title="Precio Venta"
								>
									{formatPrice(treatment.salePrice ?? treatment.price)}
								</span>
								{#if !treatment.isActive}
									<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
										>Inactivo</span
									>
								{/if}
								<div class="flex gap-1">
									<button
										type="button"
										class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
										onclick={() => startEdit(treatment)}
									>
										<Pencil class="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										class="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
										onclick={() => openDelete(treatment)}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- Create form (inline at bottom) -->
			{#if showCreateForm && supplier}
				<form
					{...currentCreateForm.enhance(async ({ submit }) => {
						await submit();
						handleCreateResult();
					})}
					class="space-y-3 rounded-lg border border-blue-200 bg-blue-50/30 p-3"
				>
					<input type="hidden" name="supplierId" value={supplier.id} />
					<div class="flex items-start gap-3">
						<div class="flex-1">
							<input
								name="name"
								type="text"
								class="w-full rounded-md border-slate-300 text-sm focus:border-blue-500 focus:ring-blue-500"
								placeholder="Nombre del tratamiento"
							/>
							{#if currentCreateForm.fields.name?.issues()}
								<p class="mt-1 text-xs text-red-500">{currentCreateForm.fields.name.issues()}</p>
							{/if}
						</div>
						<Select name="category" value={TreatmentCategory.AR} class="w-36 text-sm">
							{#each ALL_TREATMENT_CATEGORIES as cat (cat)}
								<option value={cat}>{TREATMENT_CATEGORY_LABELS[cat]}</option>
							{/each}
						</Select>
						<div class="flex gap-1">
							<Button type="submit" size="xs" color="blue" class="p-1.5">
								<Check class="h-3.5 w-3.5" />
							</Button>
							<Button type="button" size="xs" color="light" class="p-1.5" onclick={cancelCreate}>
								<X class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="w-28">
							<label for="create-price" class="mb-1 block text-[11px] font-medium text-slate-500"
								>Costo</label
							>
							<input
								id="create-price"
								name="price"
								type="number"
								step="0.01"
								min="0"
								class="w-full rounded-md border-slate-300 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
								placeholder="0.00"
							/>
							{#if currentCreateForm.fields.price?.issues()}
								<p class="mt-1 text-xs text-red-500">{currentCreateForm.fields.price.issues()}</p>
							{/if}
						</div>
						<div class="w-28">
							<label
								for="create-salePrice"
								class="mb-1 block text-[11px] font-medium text-slate-500">Precio Venta</label
							>
							<input
								id="create-salePrice"
								name="salePrice"
								type="number"
								step="0.01"
								min="0"
								class="w-full rounded-md border-slate-300 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
								placeholder="0.00"
							/>
						</div>
						<div class="flex items-center gap-2 pt-4">
							<input type="hidden" name="isTaxable" value={String(createTaxable)} />
							<button
								type="button"
								class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {createTaxable
									? 'bg-blue-600'
									: 'bg-slate-200'}"
								onclick={() => (createTaxable = !createTaxable)}
								role="switch"
								aria-checked={createTaxable}
								aria-label="IVA"
							>
								<span
									class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 {createTaxable
										? 'translate-x-4'
										: 'translate-x-0'}"
								></span>
							</button>
							<span class="text-xs text-slate-600">IVA</span>
						</div>
						{#if createTaxable}
							<div class="w-20">
								<label
									for="create-taxRate"
									class="mb-1 block text-[11px] font-medium text-slate-500">Tasa %</label
								>
								<input
									id="create-taxRate"
									name="taxRate"
									type="number"
									step="0.01"
									min="0"
									value="16"
									class="w-full rounded-md border-slate-300 text-right font-mono text-sm focus:border-blue-500 focus:ring-blue-500"
									placeholder="16"
								/>
							</div>
						{/if}
					</div>
				</form>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex w-full items-center justify-between">
			{#if !showCreateForm && !loading}
				<Button size="sm" color="blue" outline onclick={openCreate}>
					<Plus class="mr-1.5 h-4 w-4" />
					Agregar Tratamiento
				</Button>
			{:else}
				<div></div>
			{/if}
			<Button size="sm" color="light" onclick={handleClose}>Cerrar</Button>
		</div>
	{/snippet}
</Modal>

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
