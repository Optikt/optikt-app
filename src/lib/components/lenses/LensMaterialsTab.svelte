<script lang="ts">
	import { Check, FlaskConical, Pencil, Search, Trash2, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		createLensMaterialForm,
		deleteLensMaterialById,
		listLensMaterials,
		updateLensMaterialForm
	} from '$lib/remote/lenses.remote';
	import type { LensMaterial } from '$lib/server/db/schema';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { ConfirmModal, SlideOver } from '$lib/components/ui';
	import { untrack } from 'svelte';

	interface Props {
		initialMaterials: LensMaterial[];
		canManage?: boolean;
		drawTrigger: number;
	}

	let {
		initialMaterials,
		canManage = true,
		drawTrigger
	}: Props = $props();

	let materials = $state<LensMaterial[]>(untrack(() => initialMaterials));
	let search = $state('');
	let loading = $state(false);
	let editingId = $state<string | null>(null);
	let showDeleteModal = $state(false);
	let showDrawer = $state(false);
	let deleteLoading = $state(false);
	let selectedMaterial = $state<LensMaterial | null>(null);

	let draftName = $state('');
	let draftCode = $state('');
	let draftRefractiveIndex = $state('');
	let draftDescription = $state('');

	let createFormId = $state(generateUUID());
	let updateFormId = $state(generateUUID());

	const currentCreateForm = $derived(createLensMaterialForm.for(createFormId));
	const currentUpdateForm = $derived(updateLensMaterialForm.for(updateFormId));

	const filteredMaterials = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return materials;
		return materials.filter((material) => {
			const haystack = [
				material.name,
				material.code,
				material.description ?? '',
				material.refractiveIndex?.toString() ?? ''
			]
				.join(' ')
				.toLowerCase();
			return haystack.includes(term);
		});
	});

	$effect(() => {
		if (drawTrigger > 0) startAdd();
	});

	async function refreshMaterials() {
		try {
			materials = await listLensMaterials(undefined).run();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando materiales'));
		}
	}

	function resetDraft() {
		draftName = '';
		draftCode = '';
		draftRefractiveIndex = '';
		draftDescription = '';
	}

	function startAdd() {
		if (!canManage) return;
		editingId = null;
		showDrawer = true;
		resetDraft();
		createFormId = generateUUID();
	}

	function startEdit(material: LensMaterial) {
		if (!canManage) return;
		editingId = material.id;
		showDrawer = true;
		draftName = material.name;
		draftCode = material.code;
		draftRefractiveIndex = material.refractiveIndex?.toString() ?? '';
		draftDescription = material.description ?? '';
		updateFormId = generateUUID();
	}

	function closeDrawer() {
		showDrawer = false;
		editingId = null;
		resetDraft();
	}

	function openDelete(material: LensMaterial) {
		if (!canManage) return;
		selectedMaterial = material;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedMaterial) return;
		deleteLoading = true;
		try {
			await deleteLensMaterialById({ id: selectedMaterial.id });
			toast.success('Material eliminado');
			showDeleteModal = false;
			if (editingId === selectedMaterial.id) closeDrawer();
			await refreshMaterials();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando material'));
		} finally {
			deleteLoading = false;
		}
	}

	function getIndexChip(index: number | null): { label: string; cls: string } {
		if (index == null)
			return { label: 'Sin índice', cls: 'rounded-lg bg-warning-container px-2 py-0.5 text-xs font-bold text-warning' };
		if (index >= 1.67)
			return {
				label: `Índice ${index.toFixed(2)}`,
				cls: 'rounded-lg bg-warning-container px-2 py-0.5 text-xs font-bold text-warning'
			};
		if (index >= 1.6)
			return { label: `Índice ${index.toFixed(2)}`, cls: 'rounded-lg bg-info-container px-2 py-0.5 text-xs font-bold text-info' };
		return {
			label: `Índice ${index.toFixed(2)}`,
			cls: 'rounded-lg bg-surface-container-high px-2 py-0.5 text-xs font-bold text-on-surface-variant'
		};
	}
</script>

<div class="space-y-3">
	<!-- Search -->
	<div class="relative">
		<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
		<input
			type="search"
			bind:value={search}
			placeholder="Buscar por nombre, código o índice..."
			class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 pl-9 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
		/>
	</div>

	<!-- Grid de Cards -->
	{#if filteredMaterials.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-outline"
			>
				<FlaskConical class="h-6 w-6" />
			</div>
			<p class="mt-3 font-semibold text-on-surface-variant">No hay materiales para mostrar</p>
			<p class="mt-1 text-sm text-outline">Ajusta la búsqueda o crea un nuevo material.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
			{#each filteredMaterials as material (material.id)}
				<div
					class="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-2.5 shadow-sm transition-all hover:shadow-md"
				>
					<!-- Top: Name + Status -->
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate text-base font-bold text-on-surface">{material.name}</p>
						</div>
						<span
							class="shrink-0 rounded-lg bg-success-container px-2 py-0.5 text-xs font-semibold text-success"
						>
							Activo
						</span>
					</div>

					<!-- Attribute Chips -->
					<div class="flex flex-wrap gap-1 items-center justify-between">
						<span class="font-mono text-xs text-outline">{material.code}</span>
						<span class="{getIndexChip(material.refractiveIndex).cls}">
							{getIndexChip(material.refractiveIndex).label}
						</span>
					</div>

					{#if material.description}
						<p class="line-clamp-2 text-xs text-on-surface-variant" title={material.description}>{material.description}</p>
					{/if}

					<div class="flex-1"></div>

					<!-- Divider + Actions -->
					<div class="flex items-center justify-end gap-1 border-t border-outline-variant/20 pt-1.5">
						{#if canManage}
							<button
								type="button"
								onclick={() => startEdit(material)}
								class="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
								title="Editar"
							>
								<Pencil class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onclick={() => openDelete(material)}
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

<SlideOver
	bind:open={showDrawer}
	onclose={closeDrawer}
>
	{#snippet header({ onclose })}
		<div class="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-6 py-4">
			<div class="min-w-0">
				{#if editingId}
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">EDITANDO MATERIAL</p>
				{:else}
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">NUEVO MATERIAL</p>
				{/if}
				<h2 class="truncate text-sm font-bold text-on-surface">
					{editingId ? 'Actualiza la ficha técnica' : 'Agrega un material a la biblioteca'}
				</h2>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="shrink-0 cursor-pointer rounded-md max-sm:p-3 p-1.5 text-outline transition-colors hover:bg-surface-container-low hover:text-on-surface-variant"
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
						toast.success('Material actualizado');
						closeDrawer();
						await refreshMaterials();
					} else {
						toastUnboundErrors(allIssues);
					}
				} catch (error) {
					console.error(error);
					toast.error('Error actualizando material');
				} finally {
					loading = false;
				}
			})}
			class="grid gap-3 sm:grid-cols-[1fr_160px_140px_1fr]"
		>
			<input type="hidden" name="id" value={editingId} />
			<div>
				<label
					for="mat-name-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Nombre</label
				>
				<input
					id="mat-name-edit"
					name="name"
					type="text"
					bind:value={draftName}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
				{#if currentUpdateForm.fields.name?.issues()}
					<p class="mt-1 text-xs text-error">{currentUpdateForm.fields.name.issues()}</p>
				{/if}
			</div>
			<div>
				<label
					for="mat-code-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Código</label
				>
				<input
					id="mat-code-edit"
					name="code"
					type="text"
					bind:value={draftCode}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 font-mono text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
				{#if currentUpdateForm.fields.code?.issues()}
					<p class="mt-1 text-xs text-error">{currentUpdateForm.fields.code.issues()}</p>
				{/if}
			</div>
			<div>
				<label
					for="mat-index-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Índice</label
				>
				{#if draftRefractiveIndex}
					<input type="hidden" name="refractiveIndex" value={draftRefractiveIndex} />
				{/if}
				<input
					id="mat-index-edit"
					type="number"
					bind:value={draftRefractiveIndex}
					step="0.01"
					placeholder="1.50"
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 font-mono text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
			</div>
			<div>
				<label
					for="mat-desc-edit"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Descripción</label
				>
				<input
					id="mat-desc-edit"
					name="description"
					type="text"
					bind:value={draftDescription}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
			</div>
			<div class="flex justify-end gap-2 sm:col-span-4">
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
					{#if loading}<span class="spinner h-4 w-4"></span>{:else}<Check
							class="h-4 w-4"
						/>{/if}
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
						toast.success('Material creado');
						closeDrawer();
						await refreshMaterials();
					} else {
						toastUnboundErrors(allIssues);
					}
				} catch (error) {
					console.error(error);
					toast.error('Error creando material');
				} finally {
					loading = false;
				}
			})}
			class="grid gap-3 sm:grid-cols-[1fr_160px_140px_1fr]"
		>
			<div>
				<label
					for="mat-name-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Nombre</label
				>
				<input
					id="mat-name-create"
					name="name"
					type="text"
					bind:value={draftName}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
				{#if currentCreateForm.fields.name?.issues()}
					<p class="mt-1 text-xs text-error">{currentCreateForm.fields.name.issues()}</p>
				{/if}
			</div>
			<div>
				<label
					for="mat-code-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Código</label
				>
				<input
					id="mat-code-create"
					name="code"
					type="text"
					bind:value={draftCode}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 font-mono text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
				{#if currentCreateForm.fields.code?.issues()}
					<p class="mt-1 text-xs text-error">{currentCreateForm.fields.code.issues()}</p>
				{/if}
			</div>
			<div>
				<label
					for="mat-index-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Índice</label
				>
				{#if draftRefractiveIndex}
					<input type="hidden" name="refractiveIndex" value={draftRefractiveIndex} />
				{/if}
				<input
					id="mat-index-create"
					type="number"
					bind:value={draftRefractiveIndex}
					step="0.01"
					placeholder="1.50"
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 font-mono text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
			</div>
			<div>
				<label
					for="mat-desc-create"
					class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
					>Descripción</label
				>
				<input
					id="mat-desc-create"
					name="description"
					type="text"
					bind:value={draftDescription}
					class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue/15"
				/>
			</div>
			<div class="flex justify-end gap-2 sm:col-span-4">
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
					{#if loading}<span class="spinner h-4 w-4"></span>{:else}<Check
							class="h-4 w-4"
						/>{/if}
					Crear
				</button>
			</div>
		</form>
	{/if}
</SlideOver>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar material"
	message={selectedMaterial
		? `¿Eliminar "${selectedMaterial.name}" de la biblioteca de materiales?`
		: undefined}
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
