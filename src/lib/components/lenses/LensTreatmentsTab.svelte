<script lang="ts">
	import { Button, Label, Input, Badge, Select } from 'flowbite-svelte';
	import { Plus, Pencil, Trash2, X, Check, DollarSign } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { getErrorMessage } from '$lib/utils';
	import {
		listLensTreatments,
		createLensTreatmentForm,
		updateLensTreatmentForm,
		deleteLensTreatmentById,
		listSupplierTreatments,
		upsertSupplierTreatmentCmd,
		deleteSupplierTreatmentCmd
	} from '$lib/remote/lenses.remote';
	import type { LensTreatment } from '$lib/server/db/schema';
	import { generateUUID } from '$lib/utils/generateUUID';

	type SupplierOption = { id: string; name: string };

	type SupplierTreatmentRow = {
		id: string;
		price: number;
		isAvailable: boolean;
		treatment: { id: string; name: string; code: string };
	};

	type Props = {
		initialTreatments: LensTreatment[];
		suppliers?: SupplierOption[];
	};

	let { initialTreatments, suppliers = [] }: Props = $props();

	// ============================================================================
	// GLOBAL TREATMENTS (CRUD)
	// ============================================================================

	let treatments = $state<LensTreatment[]>(untrack(() => initialTreatments));
	let loading = $state(false);
	let showAddRow = $state(false);
	let editingId = $state<string | null>(null);

	// New treatment form
	let newName = $state('');
	let newCode = $state('');
	let newDescription = $state('');

	// Edit treatment form
	let editName = $state('');
	let editCode = $state('');
	let editDescription = $state('');

	// Form instances
	let createFormId = $state(generateUUID());
	let updateFormId = $state(generateUUID());
	const currentCreateForm = $derived(createLensTreatmentForm.for(createFormId));
	const currentUpdateForm = $derived(updateLensTreatmentForm.for(updateFormId));

	async function refreshTreatments() {
		try {
			treatments = await listLensTreatments(undefined);
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando tratamientos'));
		}
	}

	function startAdd() {
		showAddRow = true;
		editingId = null;
		newName = '';
		newCode = '';
		newDescription = '';
		createFormId = generateUUID();
	}

	function cancelAdd() {
		showAddRow = false;
	}

	function startEdit(treatment: LensTreatment) {
		editingId = treatment.id;
		showAddRow = false;
		editName = treatment.name;
		editCode = treatment.code;
		editDescription = treatment.description ?? '';
		updateFormId = generateUUID();
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleDelete(id: string) {
		if (!confirm('¿Eliminar este tratamiento?')) return;
		try {
			await deleteLensTreatmentById({ id });
			toast.success('Tratamiento eliminado');
			await refreshTreatments();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando tratamiento'));
		}
	}

	// ============================================================================
	// SUPPLIER TREATMENTS (per-supplier pricing)
	// ============================================================================

	let selectedSupplierId = $state('');
	let supplierTreatments = $state<SupplierTreatmentRow[]>([]);
	let supplierLoading = $state(false);

	// Assign form state
	let showAssignRow = $state(false);
	let assignTreatmentId = $state('');
	let assignPrice = $state('0');

	// Edit price state
	let editingSupTreatId = $state<string | null>(null);
	let editSupPrice = $state('');

	// Available treatments (not yet assigned to this supplier)
	const unassignedTreatments = $derived(
		treatments.filter((t) => !supplierTreatments.some((st) => st.treatment.id === t.id))
	);

	async function loadSupplierTreatments() {
		if (!selectedSupplierId) {
			supplierTreatments = [];
			return;
		}
		supplierLoading = true;
		try {
			supplierTreatments = await listSupplierTreatments({ supplierId: selectedSupplierId });
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando tratamientos del proveedor'));
		} finally {
			supplierLoading = false;
		}
	}

	$effect(() => {
		if (selectedSupplierId) {
			untrack(() => loadSupplierTreatments());
		}
	});

	function startAssign() {
		showAssignRow = true;
		assignTreatmentId = '';
		assignPrice = '0';
	}

	function cancelAssign() {
		showAssignRow = false;
	}

	async function handleAssign() {
		if (!assignTreatmentId || !selectedSupplierId) return;
		loading = true;
		try {
			await upsertSupplierTreatmentCmd({
				supplierId: selectedSupplierId,
				treatmentId: assignTreatmentId,
				price: parseFloat(assignPrice) || 0,
				isAvailable: true
			});
			toast.success('Tratamiento asignado al proveedor');
			showAssignRow = false;
			await loadSupplierTreatments();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error asignando tratamiento'));
		} finally {
			loading = false;
		}
	}

	function startEditPrice(st: SupplierTreatmentRow) {
		editingSupTreatId = st.id;
		editSupPrice = st.price.toString();
	}

	function cancelEditPrice() {
		editingSupTreatId = null;
	}

	async function savePrice(st: SupplierTreatmentRow) {
		loading = true;
		try {
			await upsertSupplierTreatmentCmd({
				supplierId: selectedSupplierId,
				treatmentId: st.treatment.id,
				price: parseFloat(editSupPrice) || 0,
				isAvailable: st.isAvailable
			});
			toast.success('Precio actualizado');
			editingSupTreatId = null;
			await loadSupplierTreatments();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error actualizando precio'));
		} finally {
			loading = false;
		}
	}

	async function handleRemoveSupplierTreatment(id: string) {
		if (!confirm('¿Quitar este tratamiento del proveedor?')) return;
		try {
			await deleteSupplierTreatmentCmd({ id });
			toast.success('Tratamiento removido del proveedor');
			await loadSupplierTreatments();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error removiendo tratamiento'));
		}
	}
</script>

<div class="space-y-8">
	<!-- ================================================================== -->
	<!-- SUPPLIER TREATMENTS SECTION -->
	<!-- ================================================================== -->
	{#if suppliers.length > 0}
		<div class="space-y-4">
			<div>
				<h3 class="text-lg font-semibold text-slate-800">Tratamientos por Proveedor</h3>
				<p class="text-sm text-slate-500">
					Configura qué tratamientos ofrece cada proveedor y a qué precio
				</p>
			</div>

			<!-- Supplier selector -->
			<div class="max-w-xs">
				<Label for="supplier-select" class="mb-2">Proveedor</Label>
				<Select
					id="supplier-select"
					bind:value={selectedSupplierId}
					onchange={() => loadSupplierTreatments()}
				>
					<option value="">Seleccionar proveedor...</option>
					{#each suppliers as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</Select>
			</div>

			{#if selectedSupplierId}
				<div class="overflow-x-auto rounded-lg border border-slate-200">
					<table class="w-full text-left text-sm">
						<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
							<tr>
								<th class="px-4 py-3">Tratamiento</th>
								<th class="px-4 py-3">Código</th>
								<th class="px-4 py-3 text-right">Precio</th>
								<th class="px-4 py-3 text-right">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#if showAssignRow}
								<tr class="bg-blue-50/50">
									<td class="px-4 py-2" colspan="2">
										<Select bind:value={assignTreatmentId} size="sm">
											<option value="">Seleccionar tratamiento...</option>
											{#each unassignedTreatments as t (t.id)}
												<option value={t.id}>{t.name} ({t.code})</option>
											{/each}
										</Select>
									</td>
									<td class="px-4 py-2 text-right">
										<Input
											bind:value={assignPrice}
											type="number"
											step="0.01"
											min="0"
											size="sm"
											placeholder="0.00"
											class="ml-auto w-28 text-right font-mono"
										/>
									</td>
									<td class="px-4 py-2">
										<div class="flex justify-end gap-1">
											<Button
												size="xs"
												color="green"
												onclick={handleAssign}
												disabled={loading || !assignTreatmentId}
											>
												<Check class="h-3.5 w-3.5" />
											</Button>
											<Button size="xs" color="alternative" onclick={cancelAssign}>
												<X class="h-3.5 w-3.5" />
											</Button>
										</div>
									</td>
								</tr>
							{/if}

							{#if supplierLoading}
								<tr>
									<td colspan="4" class="px-4 py-6 text-center text-sm text-slate-400">
										Cargando...
									</td>
								</tr>
							{:else if supplierTreatments.length === 0 && !showAssignRow}
								<tr>
									<td colspan="4" class="px-4 py-6 text-center text-sm text-slate-400">
										Este proveedor no tiene tratamientos asignados
									</td>
								</tr>
							{:else}
								{#each supplierTreatments as st (st.id)}
									<tr class="hover:bg-slate-50">
										<td class="px-4 py-3 font-medium text-slate-800">
											{st.treatment.name}
										</td>
										<td class="px-4 py-3">
											<Badge color="gray" class="font-mono text-xs">{st.treatment.code}</Badge>
										</td>
										<td class="px-4 py-3 text-right">
											{#if editingSupTreatId === st.id}
												<Input
													bind:value={editSupPrice}
													type="number"
													step="0.01"
													min="0"
													size="sm"
													class="ml-auto w-28 text-right font-mono"
												/>
											{:else}
												<span class="font-mono text-slate-800">
													${st.price.toFixed(2)}
												</span>
											{/if}
										</td>
										<td class="px-4 py-3">
											<div class="flex justify-end gap-1">
												{#if editingSupTreatId === st.id}
													<Button
														size="xs"
														color="green"
														onclick={() => savePrice(st)}
														disabled={loading}
													>
														<Check class="h-3.5 w-3.5" />
													</Button>
													<Button size="xs" color="alternative" onclick={cancelEditPrice}>
														<X class="h-3.5 w-3.5" />
													</Button>
												{:else}
													<Button size="xs" color="alternative" onclick={() => startEditPrice(st)}>
														<DollarSign class="h-3.5 w-3.5" />
													</Button>
													<Button
														size="xs"
														color="red"
														outline
														onclick={() => handleRemoveSupplierTreatment(st.id)}
													>
														<Trash2 class="h-3.5 w-3.5" />
													</Button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>

				<div class="flex justify-end">
					<Button
						size="sm"
						color="blue"
						outline
						onclick={startAssign}
						disabled={showAssignRow || unassignedTreatments.length === 0}
					>
						<Plus class="mr-1.5 h-4 w-4" />
						Asignar Tratamiento
					</Button>
				</div>
			{/if}
		</div>

		<hr class="border-slate-200" />
	{/if}

	<!-- ================================================================== -->
	<!-- GLOBAL TREATMENTS (CRUD)                                            -->
	<!-- ================================================================== -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-lg font-semibold text-slate-800">Tratamientos Globales</h3>
				<p class="text-sm text-slate-500">
					Lista maestra de tratamientos disponibles (antirreflejo, fotocromático, blue cut, etc.)
				</p>
			</div>
			<Button size="sm" color="blue" onclick={startAdd} disabled={showAddRow}>
				<Plus class="mr-1.5 h-4 w-4" />
				Agregar
			</Button>
		</div>

		<div class="overflow-x-auto rounded-lg border border-slate-200">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3">Nombre</th>
						<th class="px-4 py-3">Código</th>
						<th class="px-4 py-3">Descripción</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#if showAddRow}
						<tr class="bg-blue-50/50">
							<td class="px-4 py-2">
								<form
									data-form-id={createFormId}
									{...currentCreateForm.enhance(async ({ submit }) => {
										loading = true;
										try {
											await submit();
											const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
											if (allIssues.length === 0) {
												toast.success('Tratamiento creado');
												showAddRow = false;
												await refreshTreatments();
											}
										} catch (e) {
											console.error(e);
											toast.error('Error creando tratamiento');
										} finally {
											loading = false;
										}
									})}
								>
									<input type="hidden" name="name" value={newName} />
									<input type="hidden" name="code" value={newCode} />
									{#if newDescription}
										<input type="hidden" name="description" value={newDescription} />
									{/if}
									<Input bind:value={newName} placeholder="Nombre" size="sm" />
									{#if currentCreateForm.fields.name?.issues()}
										<p class="mt-1 text-xs text-red-500">
											{currentCreateForm.fields.name.issues()}
										</p>
									{/if}
								</form>
							</td>
							<td class="px-4 py-2">
								<Input bind:value={newCode} placeholder="Código" size="sm" />
							</td>
							<td class="px-4 py-2">
								<Input bind:value={newDescription} placeholder="Descripción" size="sm" />
							</td>
							<td class="px-4 py-2">
								<div class="flex justify-end gap-1">
									<Button
										size="xs"
										color="green"
										onclick={() => {
											const form = document.querySelector(
												`[data-form-id="${createFormId}"]`
											) as HTMLFormElement;
											form?.requestSubmit();
										}}
										disabled={loading || !newName || !newCode}
									>
										<Check class="h-3.5 w-3.5" />
									</Button>
									<Button size="xs" color="alternative" onclick={cancelAdd}>
										<X class="h-3.5 w-3.5" />
									</Button>
								</div>
							</td>
						</tr>
					{/if}

					{#each treatments as treatment (treatment.id)}
						{#if editingId === treatment.id}
							<tr class="bg-amber-50/50">
								<td class="px-4 py-2">
									<form
										data-form-id={updateFormId}
										{...currentUpdateForm.enhance(async ({ submit }) => {
											loading = true;
											try {
												await submit();
												const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
												if (allIssues.length === 0) {
													toast.success('Tratamiento actualizado');
													editingId = null;
													await refreshTreatments();
												}
											} catch (e) {
												console.error(e);
												toast.error('Error actualizando tratamiento');
											} finally {
												loading = false;
											}
										})}
									>
										<input type="hidden" name="id" value={treatment.id} />
										<input type="hidden" name="name" value={editName} />
										<input type="hidden" name="code" value={editCode} />
										<input type="hidden" name="description" value={editDescription} />
										<Input bind:value={editName} size="sm" />
									</form>
								</td>
								<td class="px-4 py-2">
									<Input bind:value={editCode} size="sm" />
								</td>
								<td class="px-4 py-2">
									<Input bind:value={editDescription} size="sm" />
								</td>
								<td class="px-4 py-2">
									<div class="flex justify-end gap-1">
										<Button
											size="xs"
											color="green"
											onclick={() => {
												const form = document.querySelector(
													`[data-form-id="${updateFormId}"]`
												) as HTMLFormElement;
												form?.requestSubmit();
											}}
											disabled={loading}
										>
											<Check class="h-3.5 w-3.5" />
										</Button>
										<Button size="xs" color="alternative" onclick={cancelEdit}>
											<X class="h-3.5 w-3.5" />
										</Button>
									</div>
								</td>
							</tr>
						{:else}
							<tr class="hover:bg-slate-50">
								<td class="px-4 py-3 font-medium text-slate-800">{treatment.name}</td>
								<td class="px-4 py-3">
									<Badge color="gray" class="font-mono text-xs">{treatment.code}</Badge>
								</td>
								<td class="px-4 py-3 text-slate-500">{treatment.description ?? '—'}</td>
								<td class="px-4 py-3">
									<div class="flex justify-end gap-1">
										<Button size="xs" color="alternative" onclick={() => startEdit(treatment)}>
											<Pencil class="h-3.5 w-3.5" />
										</Button>
										<Button
											size="xs"
											color="red"
											outline
											onclick={() => handleDelete(treatment.id)}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</Button>
									</div>
								</td>
							</tr>
						{/if}
					{/each}

					{#if treatments.length === 0 && !showAddRow}
						<tr>
							<td colspan="4" class="px-4 py-8 text-center text-sm text-slate-400">
								No hay tratamientos registrados
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
