<script lang="ts">
	import { autoAnimate } from '@formkit/auto-animate';
	import { Check, Cpu, Pencil, Plus, Search, Trash2, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		createLensTechnologyForm,
		updateLensTechnologyForm,
		deleteLensTechnologyById,
		listTechnologies
	} from '$lib/remote/lenses.remote';
	import { listSuppliers } from '$lib/remote/suppliers.remote';
	import type { LensTechnology } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/types';
import { generateUUID } from '$lib/utils/generateUUID';
import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
import { ConfirmModal } from '$lib/components/ui';

	interface Props {
		initialTechnologies: LensTechnology[];
		initialSuppliers: { id: string; name: string }[];
		canManage?: boolean;
	}

	let { initialTechnologies, initialSuppliers, canManage = true }: Props = $props();

	let technologies = $state<LensTechnology[]>([]);
	let suppliers = $state<{ id: string; name: string }[]>([]);
	let search = $state('');
	let loading = $state(false);
	let showComposer = $state(false);
	let editingId = $state<string | null>(null);
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let selectedTechnology = $state<LensTechnology | null>(null);

	let draftName = $state('');
	let draftSupplierId = $state('');
	let draftMinFittingHeight = $state('');

	let createFormId = $state(generateUUID());
	let updateFormId = $state(generateUUID());

	const currentCreateForm = $derived(createLensTechnologyForm.for(createFormId));
	const currentUpdateForm = $derived(updateLensTechnologyForm.for(updateFormId));

	const filteredTechnologies = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return technologies;
		return technologies.filter((tech) => {
			const haystack = [tech.name, tech.supplierId ?? ''].join(' ').toLowerCase();
			return haystack.includes(term);
		});
	});

	// Initialize from SSR data
	$effect(() => {
		if (!technologies.length && initialTechnologies.length) {
			technologies = [...initialTechnologies];
			suppliers = [...initialSuppliers];
		}
	});

	async function refreshData() {
		try {
			const [techs, supps] = await Promise.all([
				listTechnologies({ page: 1, perPage: 100 }).run(),
				listSuppliers({ page: 1, perPage: 100 }).run()
			]);
			technologies = techs;
			suppliers = (supps as PaginatedResult<{ id: string; name: string }>).items.map((s) => ({
				id: s.id,
				name: s.name
			}));
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando datos'));
		}
	}

	function getSupplierName(supplierId: string | null): string {
		if (!supplierId) return 'Global';
		return suppliers.find((s) => s.id === supplierId)?.name ?? '-';
	}

	function resetDraft() {
		draftName = '';
		draftSupplierId = '';
		draftMinFittingHeight = '';
	}

	function startAdd() {
		if (!canManage) return;
		editingId = null;
		showComposer = true;
		resetDraft();
		createFormId = generateUUID();
	}

	function startEdit(tech: LensTechnology) {
		if (!canManage) return;
		editingId = tech.id;
		showComposer = true;
		draftName = tech.name;
		draftSupplierId = tech.supplierId ?? '';
		draftMinFittingHeight = tech.minFittingHeight?.toString() ?? '';
		updateFormId = generateUUID();
	}

	function closeComposer() {
		showComposer = false;
		editingId = null;
		resetDraft();
	}

	function openDelete(tech: LensTechnology) {
		if (!canManage) return;
		selectedTechnology = tech;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedTechnology) return;
		deleteLoading = true;
		try {
			await deleteLensTechnologyById({ id: selectedTechnology.id });
			toast.success('Tecnología eliminada');
			showDeleteModal = false;
			if (editingId === selectedTechnology.id) closeComposer();
			await refreshData();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando tecnología'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-wrap gap-2">
		<div
			class="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
		>
			<Cpu class="h-3.5 w-3.5" />
			{technologies.length} tecnologías
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-full bg-info-container px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-info-container uppercase"
		>
			{technologies.filter((t) => !t.supplierId).length} globales
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-full bg-warning-container px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-warning-container uppercase"
		>
			{technologies.filter((t) => t.supplierId).length} por proveedor
		</div>
	</div>

	<section class="glass-card bg-surface-container-low p-4">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="relative lg:max-w-md lg:flex-1">
				<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					id="lens-technology-search"
					name="lens-technology-search"
					type="search"
					bind:value={search}
					placeholder="Buscar tecnología..."
					class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				/>
			</div>
			{#if canManage}
				<button
					type="button"
					onclick={startAdd}
					class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-xs font-bold tracking-[0.2em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
				>
					<Plus class="h-4 w-4" />
					Nueva tecnología
				</button>
			{/if}
		</div>
	</section>

	<div class="space-y-6" use:autoAnimate>
		{#if canManage && showComposer}
			<section class="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
				<div class="mb-4 flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold tracking-[0.18em] text-outline uppercase">
							{editingId ? 'Editar tecnología' : 'Nueva tecnología'}
						</p>
						<h3 class="font-heading mt-1 text-xl font-bold text-brand-navy">
							{editingId
								? 'Actualiza la ficha técnica de la tecnología'
								: 'Agrega una tecnología de fabricación'}
						</h3>
					</div>
					<button
						type="button"
						onclick={closeComposer}
						class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
						aria-label="Cerrar editor"
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				{#if editingId}
					<form
						data-form-id={updateFormId}
						{...currentUpdateForm.enhance(async ({ submit }) => {
							loading = true;
							try {
								await submit();
								const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
								if (allIssues.length === 0) {
									toast.success('Tecnología actualizada');
									closeComposer();
await refreshData();
		} else {
			toastUnboundErrors(allIssues);
		}
	} catch (error) {
		console.error(error);
		toast.error('Error actualizando tecnología');
	} finally {
		loading = false;
	}
})}
class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px_180px]"
>
<input type="hidden" name="id" value={editingId} />
						<div>
							<label
								for="lens-tech-name-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Nombre *
							</label>
							<input
								id="lens-tech-name-edit"
								name="name"
								type="text"
								bind:value={draftName}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							{#if currentUpdateForm.fields.name?.issues()}
								<p class="mt-2 text-xs text-error">{currentUpdateForm.fields.name.issues()}</p>
							{/if}
						</div>
						<div>
							<label
								for="lens-tech-supplier-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Proveedor
							</label>
							<select
								id="lens-tech-supplier-edit"
								name="supplierId"
								bind:value={draftSupplierId}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							>
								<option value="">Global (sin proveedor)</option>
								{#each suppliers as supplier (supplier.id)}
									<option value={supplier.id}>{supplier.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label
								for="lens-tech-height-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Altura mínima (mm)
							</label>
							{#if draftMinFittingHeight}
								<input type="hidden" name="minFittingHeight" value={draftMinFittingHeight} />
							{/if}
							<input
								id="lens-tech-height-edit"
								type="number"
								bind:value={draftMinFittingHeight}
								step="0.5"
								min="0"
								placeholder="Ej: 28"
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
						</div>
						<div class="flex justify-end gap-3 xl:col-span-3">
							<button
								type="button"
								onclick={closeComposer}
								class="rounded-lg bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
							>
								Cancelar
							</button>
							<button
								type="submit"
								disabled={loading}
								class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-60"
							>
								{#if loading}
									<span class="spinner"></span>
								{:else}
									<Check class="h-4 w-4" />
								{/if}
								Guardar cambios
							</button>
						</div>
					</form>
				{:else}
					<form
						data-form-id={createFormId}
						{...currentCreateForm.enhance(async ({ submit }) => {
							loading = true;
							try {
								await submit();
								const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
								if (allIssues.length === 0) {
									toast.success('Tecnología creada');
									closeComposer();
									await refreshData();
								} else {
									toastUnboundErrors(allIssues);
								}
							} catch (error) {
								console.error(error);
								toast.error('Error creando tecnología');
							} finally {
								loading = false;
							}
						})}
						class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px_180px]"
					>
						<div>
							<label
								for="lens-tech-name-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Nombre *
							</label>
							<input
								id="lens-tech-name-create"
								name="name"
								type="text"
								bind:value={draftName}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							{#if currentCreateForm.fields.name?.issues()}
								<p class="mt-2 text-xs text-error">{currentCreateForm.fields.name.issues()}</p>
							{/if}
						</div>
						<div>
							<label
								for="lens-tech-supplier-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Proveedor
							</label>
							<select
								id="lens-tech-supplier-create"
								name="supplierId"
								bind:value={draftSupplierId}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							>
								<option value="">Global (sin proveedor)</option>
								{#each suppliers as supplier (supplier.id)}
									<option value={supplier.id}>{supplier.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label
								for="lens-tech-height-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Altura mínima (mm)
							</label>
							{#if draftMinFittingHeight}
								<input type="hidden" name="minFittingHeight" value={draftMinFittingHeight} />
							{/if}
							<input
								id="lens-tech-height-create"
								type="number"
								bind:value={draftMinFittingHeight}
								step="0.5"
								min="0"
								placeholder="Ej: 28"
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
						</div>
						<div class="flex justify-end gap-3 xl:col-span-3">
							<button
								type="button"
								onclick={closeComposer}
								class="rounded-lg bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
							>
								Cancelar
							</button>
							<button
								type="submit"
								disabled={loading}
								class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-60"
							>
								{#if loading}
									<span class="spinner"></span>
								{:else}
									<Check class="h-4 w-4" />
								{/if}
								Crear tecnología
							</button>
						</div>
					</form>
				{/if}
			</section>
		{/if}
	</div>

	<section class="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[700px] text-left">
				<thead>
					<tr class="bg-surface-container-low">
						<th class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
							Tecnología
						</th>
						<th class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
							Proveedor
						</th>
						<th class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
							Altura mínima
						</th>
						<th class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
							Estado
						</th>
						{#if canManage}
							<th class="px-6 py-4 text-right text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
								Acciones
							</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-low" use:autoAnimate>
					{#if filteredTechnologies.length === 0}
						<tr>
							<td colspan={canManage ? 5 : 4} class="px-6 py-12 text-center">
								<div class="mx-auto max-w-md space-y-2">
									<p class="font-medium text-on-surface-variant">No hay tecnologías para mostrar</p>
									<p class="text-sm text-outline">Ajusta la búsqueda o crea una nueva tecnología.</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredTechnologies as tech (tech.id)}
							<tr class="transition-colors hover:bg-surface-container-low">
								<td class="px-6 py-5">
									<div class="flex items-center gap-4">
										<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-high text-brand-blue">
											<Cpu class="h-5 w-5" />
										</div>
										<div>
											<p class="font-semibold text-on-surface">{tech.name}</p>
										</div>
									</div>
								</td>
								<td class="px-6 py-5">
									<span class="rounded-md bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface-variant">
										{getSupplierName(tech.supplierId)}
									</span>
								</td>
								<td class="px-6 py-5 font-mono text-sm text-on-surface-variant">
									{tech.minFittingHeight != null ? `${tech.minFittingHeight} mm` : '-'}
								</td>
								<td class="px-6 py-5">
									<span
										class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold {tech.isActive
											? 'bg-success-container text-on-success-container'
											: 'bg-error-container text-on-error-container'}"
									>
										<span class="h-1.5 w-1.5 rounded-full {tech.isActive ? 'bg-green-600' : 'bg-red-600'}"></span>
										{tech.isActive ? 'Activo' : 'Inactivo'}
									</span>
								</td>
								{#if canManage}
									<td class="px-6 py-5 text-right">
										<div class="flex items-center justify-end gap-1">
											<button
												type="button"
												onclick={() => startEdit(tech)}
												class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
												title="Editar tecnología"
											>
												<Pencil class="h-4 w-4" />
											</button>
											<button
												type="button"
												onclick={() => openDelete(tech)}
												class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
												title="Eliminar tecnología"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
		<div class="flex items-center justify-between gap-4 px-6 py-4 text-xs font-semibold tracking-[0.18em] text-outline uppercase">
			<p>Mostrando {filteredTechnologies.length} de {technologies.length} tecnologías</p>
			{#if search.trim()}
				<p>Filtro activo</p>
			{/if}
		</div>
	</section>
</div>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar tecnología"
	message={selectedTechnology
		? `¿Eliminar "${selectedTechnology.name}" de la biblioteca de tecnologías?`
		: undefined}
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
