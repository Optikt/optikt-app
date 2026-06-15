<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { Check, Pencil, Search, Tags, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		listDifferentiators,
		renameDifferentiatorForm,
		deleteDifferentiatorById
	} from '$lib/remote/lenses.remote';
	import { ConfirmModal } from '$lib/components/ui';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';

	interface Props {
		initialDifferentiators: string[];
		canManage?: boolean;
	}

	let { initialDifferentiators, canManage = true }: Props = $props();

	let differentiators = $state<string[]>([]);
	let search = $state('');
	let loading = $state(false);

	// Rename modal state
	let showRenameModal = $state(false);
	let renameLoading = $state(false);
	let renameOldName = $state('');
	let renameNewName = $state('');
	let renameFormId = $state(generateUUID());

	// Delete modal state
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let deleteName = $state('');

	const currentRenameForm = $derived(renameDifferentiatorForm.for(renameFormId));

	const filteredDifferentiators = $derived.by(() => {
		const term = search.trim().toLowerCase();
		if (!term) return differentiators;
		return differentiators.filter((d) => d.toLowerCase().includes(term));
	});

	// Initialize from SSR data
	$effect(() => {
		if (!differentiators.length && initialDifferentiators.length) {
			differentiators = [...initialDifferentiators];
		}
	});

	async function refreshData() {
		try {
			const tags = await listDifferentiators({ page: 1, perPage: 100 }).run();
			differentiators = tags;
		} catch (error) {
			console.error(error);
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
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando etiqueta'));
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
			<Tags class="h-3.5 w-3.5" />
			{differentiators.length} etiquetas
		</div>
	</div>

	<section class="glass-card bg-surface-container-low p-4">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="relative lg:max-w-md lg:flex-1">
				<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					id="lens-differentiator-search"
					name="lens-differentiator-search"
					type="search"
					bind:value={search}
					placeholder="Buscar etiqueta..."
					class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				/>
			</div>
		</div>
	</section>

	<section class="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[500px] text-left">
				<thead>
					<tr class="bg-surface-container-low">
						<th class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
							Etiqueta
						</th>
						<th class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase">
							Acciones
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-low" use:autoAnimate>
					{#if filteredDifferentiators.length === 0}
						<tr>
							<td colspan={canManage ? 2 : 1} class="px-6 py-12 text-center">
								<div class="mx-auto max-w-md space-y-2">
									<p class="font-medium text-on-surface-variant">No hay etiquetas para mostrar</p>
									<p class="text-sm text-outline">Las etiquetas se crean automáticamente al asignarlas en los lentes.</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredDifferentiators as tag (tag)}
							<tr class="transition-colors hover:bg-surface-container-low">
								<td class="px-6 py-5">
									<div class="flex items-center gap-4">
										<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-high text-brand-blue">
											<Tags class="h-5 w-5" />
										</div>
										<div>
											<span class="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-1.5 text-sm font-semibold text-on-surface-variant">
												{tag}
											</span>
										</div>
									</div>
								</td>
								<td class="px-6 py-5 text-right">
									{#if canManage}
										<div class="flex items-center justify-end gap-1">
											<button
												type="button"
												onclick={() => openRename(tag)}
												class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
												title="Renombrar etiqueta"
											>
												<Pencil class="h-4 w-4" />
											</button>
											<button
												type="button"
												onclick={() => openDelete(tag)}
												class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
												title="Eliminar etiqueta"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
		<div class="flex items-center justify-between gap-4 px-6 py-4 text-xs font-semibold tracking-[0.18em] text-outline uppercase">
			<p>Mostrando {filteredDifferentiators.length} de {differentiators.length} etiquetas</p>
			{#if search.trim()}
				<p>Filtro activo</p>
			{/if}
		</div>
	</section>
</div>

<!-- Rename Modal -->
<Modal bind:open={showRenameModal} title="Renombrar etiqueta" size="sm">
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
				console.error(error);
				toast.error(getErrorMessage(error, 'Error renombrando etiqueta'));
			} finally {
				renameLoading = false;
			}
		})}
		class="flex flex-col gap-4"
	>
		<input type="hidden" name="oldName" value={renameOldName} />
		<div>
			<label for="rename-old-display" class="mb-1 block text-xs font-semibold text-outline uppercase">
				Nombre actual
			</label>
			<input
				id="rename-old-display"
				type="text"
				value={renameOldName}
				disabled
				class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface"
			/>
		</div>
		<div>
			<label for="rename-new-name" class="mb-1 block text-xs font-semibold text-outline uppercase">
				Nuevo nombre *
			</label>
			<input
				id="rename-new-name"
				name="newName"
				type="text"
				bind:value={renameNewName}
				placeholder="Nuevo nombre de la etiqueta"
				class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			/>
			{#if currentRenameForm.fields.newName?.issues()}
				<p class="mt-2 text-xs text-error">{currentRenameForm.fields.newName.issues()}</p>
			{/if}
		</div>

		<div class="mt-2 flex justify-end gap-2">
			<Button color="light" onclick={closeRename} disabled={renameLoading}>Cancelar</Button>
			<Button type="submit" color="blue" disabled={renameLoading}>
				{#if renameLoading}<Spinner size="4" class="mr-2" />{/if}
				Renombrar
			</Button>
		</div>
	</form>
</Modal>

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
