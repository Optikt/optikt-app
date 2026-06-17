<script lang="ts">
	import { Check, Cpu, Pencil, Search, Trash2, X } from '@lucide/svelte';
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
	import { ConfirmModal, SlideOver } from '$lib/components/ui';

	interface Props {
		initialTechnologies: LensTechnology[];
		initialSuppliers: { id: string; name: string }[];
		canManage?: boolean;
		drawTrigger: number;
	}

	let { initialTechnologies, initialSuppliers, canManage = true, drawTrigger }: Props = $props();

	let technologies = $state<LensTechnology[]>([]);
	let suppliers = $state<{ id: string; name: string }[]>([]);
	let search = $state('');
	let loading = $state(false);
	let editingId = $state<string | null>(null);
	let showDeleteModal = $state(false);
	let showDrawer = $state(false);
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

	$effect(() => {
		if (!technologies.length && initialTechnologies.length) {
			technologies = [...initialTechnologies];
			suppliers = [...initialSuppliers];
		}
	});

	$effect(() => {
		if (drawTrigger > 0) startAdd();
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

	function getSupplierChip(supplierId: string | null): { label: string; cls: string } {
		if (!supplierId)
			return {
				label: 'Global',
				cls: 'rounded-lg bg-info-container px-2 py-0.5 text-xs font-bold text-info'
			};
		return {
			label: getSupplierName(supplierId),
			cls: 'rounded-lg bg-surface-container-high px-2 py-0.5 text-xs font-bold text-on-surface-variant'
		};
	}

	function resetDraft() {
		draftName = '';
		draftSupplierId = '';
		draftMinFittingHeight = '';
	}

	function startAdd() {
		if (!canManage) return;
		editingId = null;
		showDrawer = true;
		resetDraft();
		createFormId = generateUUID();
	}

	function startEdit(tech: LensTechnology) {
		if (!canManage) return;
		editingId = tech.id;
		showDrawer = true;
		draftName = tech.name;
		draftSupplierId = tech.supplierId ?? '';
		draftMinFittingHeight = tech.minFittingHeight?.toString() ?? '';
		updateFormId = generateUUID();
	}

	function closeDrawer() {
		showDrawer = false;
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
			if (editingId === selectedTechnology.id) closeDrawer();
			await refreshData();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando tecnología'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<div class="space-y-3">
	<!-- Search -->
	<div class="relative">
		<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
		<input
			type="search"
			bind:value={search}
			placeholder="Buscar tecnología..."
			class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 pl-9 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
		/>
	</div>

	<!-- Grid de Cards -->
	{#if filteredTechnologies.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-outline"
			>
				<Cpu class="h-6 w-6" />
			</div>
			<p class="mt-3 font-semibold text-on-surface-variant">No hay tecnologías para mostrar</p>
			<p class="mt-1 text-sm text-outline">Ajusta la búsqueda o crea una nueva tecnología.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
			{#each filteredTechnologies as tech (tech.id)}
				<div
					class="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-2.5 shadow-sm transition-all hover:shadow-md"
				>
					<!-- Top: Name + Status -->
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate text-base font-bold text-on-surface">{tech.name}</p>
							{#if tech.supplierId}
								<p
									class="line-clamp-1 text-xs text-on-surface-variant"
									title={getSupplierName(tech.supplierId)}
								>
									{getSupplierName(tech.supplierId)}
								</p>
							{/if}
						</div>
						<span
							class="shrink-0 rounded-lg bg-success-container px-2 py-0.5 text-xs font-semibold text-success"
						>
							Activo
						</span>
					</div>

					<!-- Attribute Chips -->
					<div class="flex flex-wrap gap-1">
						<span class={getSupplierChip(tech.supplierId).cls}>
							{getSupplierChip(tech.supplierId).label}
						</span>
						{#if tech.minFittingHeight != null}
							<span
								class="rounded-lg bg-surface-container-high px-2 py-0.5 text-xs font-bold text-on-surface-variant"
							>
								Alt. mín: {tech.minFittingHeight} mm
							</span>
						{/if}
					</div>

					<!-- Spacer -->
					<div class="flex-1"></div>

					<!-- Divider + Actions -->
					<div
						class="flex items-center justify-end gap-1 border-t border-outline-variant/20 pt-1.5"
					>
						{#if canManage}
							<button
								type="button"
								onclick={() => startEdit(tech)}
								class="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
								title="Editar"
							>
								<Pencil class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onclick={() => openDelete(tech)}
								class="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
								title="Eliminar"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<SlideOver bind:open={showDrawer} onclose={closeDrawer}>
	{#snippet header({ onclose })}
		<div
			class="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-6 py-4"
		>
			<div class="min-w-0">
				{#if editingId}
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						EDITANDO TECNOLOGÍA
					</p>
				{:else}
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						NUEVA TECNOLOGÍA
					</p>
				{/if}
				<h2 class="truncate text-sm font-bold text-on-surface">
					{editingId ? 'Actualiza la ficha técnica' : 'Agrega una tecnología de fabricación'}
				</h2>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="shrink-0 cursor-pointer rounded-md p-1.5 text-outline transition-colors hover:bg-surface-container-low hover:text-on-surface-variant max-sm:p-3"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}
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
						closeDrawer();
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
			class="grid gap-3 sm:grid-cols-[1fr_220px_140px]"
		>
			<input type="hidden" name="id" value={editingId} />
			<div>
				<label
					for="tech-name-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Nombre</label
				>
				<input
					id="tech-name-edit"
					name="name"
					type="text"
					bind:value={draftName}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				/>
				{#if currentUpdateForm.fields.name?.issues()}
					<p class="mt-1 text-xs text-error">{currentUpdateForm.fields.name.issues()}</p>
				{/if}
			</div>
			<div>
				<label
					for="tech-supplier-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Proveedor</label
				>
				<select
					id="tech-supplier-edit"
					name="supplierId"
					bind:value={draftSupplierId}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				>
					<option value="">Global (sin proveedor)</option>
					{#each suppliers as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label
					for="tech-height-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Altura mín.</label
				>
				{#if draftMinFittingHeight}
					<input type="hidden" name="minFittingHeight" value={draftMinFittingHeight} />
				{/if}
				<input
					id="tech-height-edit"
					type="number"
					bind:value={draftMinFittingHeight}
					step="0.5"
					min="0"
					placeholder="mm"
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 font-mono text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				/>
			</div>
			<div class="flex justify-end gap-2 sm:col-span-3">
				<button
					type="button"
					onclick={closeDrawer}
					class="h-9 rounded-lg bg-surface-container-low px-4 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
					>Cancelar</button
				>
				<button
					type="submit"
					disabled={loading}
					class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-125 disabled:opacity-60"
				>
					{#if loading}<span class="spinner h-4 w-4"></span>{:else}<Check class="h-4 w-4" />{/if}
					Guardar
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
						closeDrawer();
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
			class="grid gap-3 sm:grid-cols-[1fr_220px_140px]"
		>
			<div>
				<label
					for="tech-name-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Nombre</label
				>
				<input
					id="tech-name-create"
					name="name"
					type="text"
					bind:value={draftName}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				/>
				{#if currentCreateForm.fields.name?.issues()}
					<p class="mt-1 text-xs text-error">{currentCreateForm.fields.name.issues()}</p>
				{/if}
			</div>
			<div>
				<label
					for="tech-supplier-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Proveedor</label
				>
				<select
					id="tech-supplier-create"
					name="supplierId"
					bind:value={draftSupplierId}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				>
					<option value="">Global (sin proveedor)</option>
					{#each suppliers as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label
					for="tech-height-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Altura mín.</label
				>
				{#if draftMinFittingHeight}
					<input type="hidden" name="minFittingHeight" value={draftMinFittingHeight} />
				{/if}
				<input
					id="tech-height-create"
					type="number"
					bind:value={draftMinFittingHeight}
					step="0.5"
					min="0"
					placeholder="mm"
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 font-mono text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				/>
			</div>
			<div class="flex justify-end gap-2 sm:col-span-3">
				<button
					type="button"
					onclick={closeDrawer}
					class="h-9 rounded-lg bg-surface-container-low px-4 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
					>Cancelar</button
				>
				<button
					type="submit"
					disabled={loading}
					class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-125 disabled:opacity-60"
				>
					{#if loading}<span class="spinner h-4 w-4"></span>{:else}<Check class="h-4 w-4" />{/if}
					Crear
				</button>
			</div>
		</form>
	{/if}
</SlideOver>

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
