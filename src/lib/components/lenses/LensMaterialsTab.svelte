<script lang="ts">
	import { Button, Input, Badge } from 'flowbite-svelte';
	import { Plus, Pencil, Trash2, X, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils';
	import {
		listLensMaterials,
		createLensMaterialForm,
		updateLensMaterialForm,
		deleteLensMaterialById
	} from '$lib/remote/lenses.remote';
	import type { LensMaterial } from '$lib/server/db/schema';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { untrack } from 'svelte';

	type Props = {
		initialMaterials: LensMaterial[];
	};

	let { initialMaterials }: Props = $props();

	// Use untrack since we know that initialMaterials will not change/be reactive
	let materials = $state<LensMaterial[]>(untrack(() => initialMaterials));
	let loading = $state(false);

	// Inline form state
	let showAddRow = $state(false);
	let editingId = $state<string | null>(null);

	// New material form
	let newName = $state('');
	let newCode = $state('');
	let newRefractiveIndex = $state('');
	let newDescription = $state('');

	// Edit material form
	let editName = $state('');
	let editCode = $state('');
	let editRefractiveIndex = $state('');
	let editDescription = $state('');

	// Form instances
	let createFormId = $state(generateUUID());
	let updateFormId = $state(generateUUID());
	const currentCreateForm = $derived(createLensMaterialForm.for(createFormId));
	const currentUpdateForm = $derived(updateLensMaterialForm.for(updateFormId));

	async function refreshMaterials() {
		try {
			materials = await listLensMaterials(undefined);
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando materiales'));
		}
	}

	function startAdd() {
		showAddRow = true;
		editingId = null;
		newName = '';
		newCode = '';
		newRefractiveIndex = '';
		newDescription = '';
		createFormId = generateUUID();
	}

	function cancelAdd() {
		showAddRow = false;
	}

	function startEdit(material: LensMaterial) {
		editingId = material.id;
		showAddRow = false;
		editName = material.name;
		editCode = material.code;
		editRefractiveIndex = material.refractiveIndex?.toString() ?? '';
		editDescription = material.description ?? '';
		updateFormId = generateUUID();
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleDelete(id: string) {
		if (!confirm('¿Eliminar este material?')) return;
		try {
			await deleteLensMaterialById({ id });
			toast.success('Material eliminado');
			await refreshMaterials();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando material'));
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold text-slate-800">Materiales de Lente</h3>
			<p class="text-sm text-slate-500">CR-39, Policarbonato, Hi-Index, etc.</p>
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
					<th class="px-4 py-3">Índice Refractivo</th>
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
											toast.success('Material creado');
											showAddRow = false;
											await refreshMaterials();
										}
									} catch (e) {
										console.error(e);
										toast.error('Error creando material');
									} finally {
										loading = false;
									}
								})}
								class="contents"
							>
								<input type="hidden" name="name" value={newName} />
								<input type="hidden" name="code" value={newCode} />
								{#if newRefractiveIndex}
									<input type="hidden" name="refractiveIndex" value={newRefractiveIndex} />
								{/if}
								{#if newDescription}
									<input type="hidden" name="description" value={newDescription} />
								{/if}
								<Input bind:value={newName} placeholder="Nombre" size="sm" />
								{#if currentCreateForm.fields.name?.issues()}
									<p class="mt-1 text-xs text-red-500">{currentCreateForm.fields.name.issues()}</p>
								{/if}
							</form>
						</td>
						<td class="px-4 py-2">
							<Input bind:value={newCode} placeholder="Código" size="sm" />
						</td>
						<td class="px-4 py-2">
							<Input
								bind:value={newRefractiveIndex}
								placeholder="1.50"
								size="sm"
								type="number"
								step="0.01"
							/>
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

				{#each materials as material (material.id)}
					{#if editingId === material.id}
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
												toast.success('Material actualizado');
												editingId = null;
												await refreshMaterials();
											}
										} catch (e) {
											console.error(e);
											toast.error('Error actualizando material');
										} finally {
											loading = false;
										}
									})}
									class="contents"
								>
									<input type="hidden" name="id" value={material.id} />
									<input type="hidden" name="name" value={editName} />
									<input type="hidden" name="code" value={editCode} />
									{#if editRefractiveIndex}
										<input type="hidden" name="refractiveIndex" value={editRefractiveIndex} />
									{/if}
									<input type="hidden" name="description" value={editDescription} />
									<Input bind:value={editName} size="sm" />
								</form>
							</td>
							<td class="px-4 py-2">
								<Input bind:value={editCode} size="sm" />
							</td>
							<td class="px-4 py-2">
								<Input bind:value={editRefractiveIndex} size="sm" type="number" step="0.01" />
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
							<td class="px-4 py-3 font-medium text-slate-800">{material.name}</td>
							<td class="px-4 py-3">
								<Badge color="gray" class="font-mono text-xs">{material.code}</Badge>
							</td>
							<td class="px-4 py-3 font-mono text-sm">
								{material.refractiveIndex ?? '—'}
							</td>
							<td class="px-4 py-3 text-slate-500">{material.description ?? '—'}</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-1">
									<Button size="xs" color="alternative" onclick={() => startEdit(material)}>
										<Pencil class="h-3.5 w-3.5" />
									</Button>
									<Button size="xs" color="red" outline onclick={() => handleDelete(material.id)}>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
								</div>
							</td>
						</tr>
					{/if}
				{/each}

				{#if materials.length === 0 && !showAddRow}
					<tr>
						<td colspan="5" class="px-4 py-8 text-center text-sm text-slate-400">
							No hay materiales registrados
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
