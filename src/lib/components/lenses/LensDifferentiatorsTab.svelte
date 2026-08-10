<script lang="ts">
	import { Pencil, Search, Tags, Trash2, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		listDifferentiators,
		renameDifferentiatorForm,
		deleteDifferentiatorById
	} from '$lib/remote/lenses.remote';
	import { ConfirmModal, SlideOver } from '$lib/components/ui';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';

	interface Props {
		initialDifferentiators: string[];
		canManage?: boolean;
	}

	let { initialDifferentiators, canManage = true }: Props = $props();

	let differentiators = $state<string[]>([]);
	let search = $state('');
	let renameLoading = $state(false);
	let showRenameModal = $state(false);
	let renameOldName = $state('');
	let renameNewName = $state('');
	let renameFormId = $state(generateUUID());
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let deleteName = $state('');

	const currentRenameForm = $derived(renameDifferentiatorForm.for(renameFormId));

	const filteredDifferentiators = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return differentiators;
		return differentiators.filter((d) => d.toLowerCase().includes(term));
	});

	$effect(() => {
		if (!differentiators.length && initialDifferentiators.length) {
			differentiators = [...initialDifferentiators];
		}
	});

	async function refreshData() {
		try {
			const tags = await listDifferentiators({ page: 1, perPage: 100 });
			differentiators = tags;
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error cargando etiquetas'));
		}
	}

	function openRename(tag: string) {
		if (!canManage) return;
		renameOldName = tag;
		renameNewName = tag;
		renameFormId = generateUUID();
		showRenameModal = true;
	}

	function closeRename() {
		showRenameModal = false;
		renameOldName = '';
		renameNewName = '';
	}

	function openDelete(tag: string) {
		if (!canManage) return;
		deleteName = tag;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!deleteName) return;
		deleteLoading = true;
		try {
			await deleteDifferentiatorById({ name: deleteName });
			toast.success(`Etiqueta "${deleteName}" eliminada de todos los lentes`);
			showDeleteModal = false;
			await refreshData();
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error eliminando etiqueta'));
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
			placeholder="Buscar etiqueta..."
			class="h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 pl-9 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
		/>
	</div>

	<!-- Grid de Cards -->
	{#if filteredDifferentiators.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-outline"
			>
				<Tags class="h-6 w-6" />
			</div>
			<p class="mt-3 font-semibold text-on-surface-variant">No hay etiquetas para mostrar</p>
			<p class="mt-1 text-sm text-outline">Las etiquetas se crean al asignarlas en los lentes.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
			{#each filteredDifferentiators as tag (tag)}
				<div
					class="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-2.5 shadow-sm transition-all hover:shadow-md"
				>
					<!-- Top: Name + Status -->
					<div class="flex items-start justify-between gap-2">
						<p class="truncate text-base font-bold text-on-surface">{tag}</p>
						<span
							class="shrink-0 rounded-lg bg-info-container px-2 py-0.5 text-xs font-semibold text-info"
						>
							En lentes
						</span>
					</div>

					<!-- Description -->
					<p class="text-xs text-on-surface-variant">Usada en lentes del catálogo</p>

					<!-- Spacer -->
					<div class="flex-1"></div>

					<!-- Divider + Actions -->
					<div
						class="flex items-center justify-end gap-1 border-t border-outline-variant/20 pt-1.5"
					>
						{#if canManage}
							<button
								type="button"
								onclick={() => openRename(tag)}
								class="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
								title="Renombrar"
							>
								<Pencil class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onclick={() => openDelete(tag)}
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

<!-- Rename SlideOver -->
<SlideOver bind:open={showRenameModal} size="md" onclose={closeRename}>
	{#snippet header({ onclose })}
		<div
			class="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-6 py-4"
		>
			<div class="min-w-0">
				<h2 class="truncate text-sm font-bold text-on-surface">Renombrar etiqueta</h2>
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
	<form
		data-form-id={renameFormId}
		{...currentRenameForm.enhance(async ({ submit }) => {
			renameLoading = true;
			try {
				await submit();
				const allIssues = currentRenameForm.fields.allIssues?.() ?? [];
				if (allIssues.length === 0) {
					toast.success(`Etiqueta renombrada a "${renameNewName}"`);
					closeRename();
					await refreshData();
				} else {
					toastUnboundErrors(allIssues);
				}
			} catch (error) {
				toast.error(getErrorMessage(error, 'Error renombrando etiqueta'));
			} finally {
				renameLoading = false;
			}
		})}
		class="flex flex-col gap-4"
	>
		<input type="hidden" name="oldName" value={renameOldName} />
		<div>
			<label
				for="rename-old-display"
				class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
				>Nombre actual</label
			>
			<input
				id="rename-old-display"
				type="text"
				value={renameOldName}
				disabled
				class="w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface"
			/>
		</div>
		<div>
			<label
				for="rename-new-name"
				class="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
				>Nuevo nombre</label
			>
			<input
				id="rename-new-name"
				name="newName"
				type="text"
				bind:value={renameNewName}
				class="w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface transition-all placeholder:text-outline focus:border-brand-blue/30 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
			/>
			{#if currentRenameForm.fields.newName?.issues()}
				<p class="mt-1 text-xs text-error">{currentRenameForm.fields.newName.issues()}</p>
			{/if}
		</div>
		<div class="mt-2 flex justify-end gap-2">
			<button
				type="button"
				onclick={closeRename}
				disabled={renameLoading}
				class="inline-flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
				>Cancelar</button
			>
			<button
				type="submit"
				disabled={renameLoading}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-blue-dark disabled:opacity-50"
			>
				Renombrar
			</button>
		</div>
	</form>
</SlideOver>

<!-- Delete Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar etiqueta"
	message={deleteName
		? `¿Eliminar "${deleteName}" de todos los lentes que la usan? Esta acción no se puede deshacer.`
		: undefined}
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
