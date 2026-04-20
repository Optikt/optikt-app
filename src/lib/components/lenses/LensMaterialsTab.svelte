<script lang="ts">
	import { autoAnimate } from '@formkit/auto-animate';
	import { Check, FlaskConical, Pencil, Plus, Search, Trash2, X } from '@lucide/svelte';
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
	import { AppBadge, ConfirmModal } from '$lib/components/ui';
	import { untrack } from 'svelte';

	interface Props {
		initialMaterials: LensMaterial[];
		canManage?: boolean;
	}

	let { initialMaterials, canManage = true }: Props = $props();

	let materials = $state<LensMaterial[]>(untrack(() => initialMaterials));
	let search = $state('');
	let loading = $state(false);
	let showComposer = $state(false);
	let editingId = $state<string | null>(null);
	let showDeleteModal = $state(false);
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

	const stats = $derived.by(() => {
		const withIndex = materials.filter((material) => material.refractiveIndex != null).length;

		return {
			total: materials.length,
			withIndex,
			withoutIndex: materials.length - withIndex
		};
	});

	async function refreshMaterials() {
		try {
			materials = await listLensMaterials(undefined);
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
		showComposer = true;
		resetDraft();
		createFormId = generateUUID();
	}

	function startEdit(material: LensMaterial) {
		if (!canManage) return;

		editingId = material.id;
		showComposer = true;
		draftName = material.name;
		draftCode = material.code;
		draftRefractiveIndex = material.refractiveIndex?.toString() ?? '';
		draftDescription = material.description ?? '';
		updateFormId = generateUUID();
	}

	function closeComposer() {
		showComposer = false;
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
			if (editingId === selectedMaterial.id) {
				closeComposer();
			}
			await refreshMaterials();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando material'));
		} finally {
			deleteLoading = false;
		}
	}

	function formatIndex(value: number | null): string {
		return value == null ? '-' : value.toFixed(2);
	}
</script>

<div class="space-y-6">
	<div class="flex flex-wrap gap-2">
		<div
			class="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
		>
			<FlaskConical class="h-3.5 w-3.5" />
			{stats.total} materiales
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-full bg-info-container px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-info-container uppercase"
		>
			{stats.withIndex} con índice cargado
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-full bg-warning-container px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-warning-container uppercase"
		>
			{stats.withoutIndex} por completar
		</div>
	</div>

	<section class="glass-card bg-surface-container-low p-4">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="relative lg:max-w-md lg:flex-1">
				<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					id="lens-material-search"
					name="lens-material-search"
					type="search"
					bind:value={search}
					placeholder="Buscar por nombre, código o índice..."
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
					Nuevo material
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
							{editingId ? 'Editar material' : 'Nuevo material'}
						</p>
						<h3 class="font-heading mt-1 text-xl font-bold text-brand-navy">
							{editingId
								? 'Actualiza la ficha técnica del material'
								: 'Agrega un material a la biblioteca'}
						</h3>
					</div>

					<button
						type="button"
						onclick={closeComposer}
						class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
						aria-label="Cerrar editor de material"
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
									toast.success('Material actualizado');
									closeComposer();
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
						class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px_180px_minmax(0,1.4fr)]"
					>
						<input type="hidden" name="id" value={editingId} />

						<div>
							<label
								for="lens-material-name-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Nombre
							</label>
							<input
								id="lens-material-name-edit"
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
								for="lens-material-code-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Código
							</label>
							<input
								id="lens-material-code-edit"
								name="code"
								type="text"
								bind:value={draftCode}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							{#if currentUpdateForm.fields.code?.issues()}
								<p class="mt-2 text-xs text-error">{currentUpdateForm.fields.code.issues()}</p>
							{/if}
						</div>

						<div>
							<label
								for="lens-material-index-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Índice
							</label>
							{#if draftRefractiveIndex}
								<input type="hidden" name="refractiveIndex" value={draftRefractiveIndex} />
							{/if}
							<input
								id="lens-material-index-edit"
								type="number"
								bind:value={draftRefractiveIndex}
								step="0.01"
								placeholder="1.50"
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							{#if currentUpdateForm.fields.refractiveIndex?.issues()}
								<p class="mt-2 text-xs text-error">
									{currentUpdateForm.fields.refractiveIndex.issues()}
								</p>
							{/if}
						</div>

						<div>
							<label
								for="lens-material-description-edit"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Descripción
							</label>
							<input
								id="lens-material-description-edit"
								name="description"
								type="text"
								bind:value={draftDescription}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
						</div>

						<div class="flex justify-end gap-3 xl:col-span-4">
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
									toast.success('Material creado');
									closeComposer();
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
						class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px_180px_minmax(0,1.4fr)]"
					>
						<div>
							<label
								for="lens-material-name-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Nombre
							</label>
							<input
								id="lens-material-name-create"
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
								for="lens-material-code-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Código
							</label>
							<input
								id="lens-material-code-create"
								name="code"
								type="text"
								bind:value={draftCode}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							{#if currentCreateForm.fields.code?.issues()}
								<p class="mt-2 text-xs text-error">{currentCreateForm.fields.code.issues()}</p>
							{/if}
						</div>

						<div>
							<label
								for="lens-material-index-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Índice
							</label>
							{#if draftRefractiveIndex}
								<input type="hidden" name="refractiveIndex" value={draftRefractiveIndex} />
							{/if}
							<input
								id="lens-material-index-create"
								type="number"
								bind:value={draftRefractiveIndex}
								step="0.01"
								placeholder="1.50"
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							{#if currentCreateForm.fields.refractiveIndex?.issues()}
								<p class="mt-2 text-xs text-error">
									{currentCreateForm.fields.refractiveIndex.issues()}
								</p>
							{/if}
						</div>

						<div>
							<label
								for="lens-material-description-create"
								class="mb-2 block text-xs font-semibold tracking-[0.18em] text-outline uppercase"
							>
								Descripción
							</label>
							<input
								id="lens-material-description-create"
								name="description"
								type="text"
								bind:value={draftDescription}
								class="w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
						</div>

						<div class="flex justify-end gap-3 xl:col-span-4">
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
								Crear material
							</button>
						</div>
					</form>
				{/if}
			</section>
		{/if}
	</div>

	<section class="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[880px] text-left">
				<thead>
					<tr class="bg-surface-container-low">
						<th
							class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase"
						>
							Material
						</th>
						<th
							class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase"
						>
							Código
						</th>
						<th
							class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase"
						>
							Índice
						</th>
						<th
							class="px-6 py-4 text-[10px] font-semibold tracking-[0.22em] text-outline uppercase"
						>
							Descripción
						</th>
						<th
							class="px-6 py-4 text-right text-[10px] font-semibold tracking-[0.22em] text-outline uppercase"
						>
							Estado
						</th>
						{#if canManage}
							<th
								class="px-6 py-4 text-right text-[10px] font-semibold tracking-[0.22em] text-outline uppercase"
							>
								Acciones
							</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-low" use:autoAnimate>
					{#if filteredMaterials.length === 0}
						<tr>
							<td colspan={canManage ? 6 : 5} class="px-6 py-12 text-center">
								<div class="mx-auto max-w-md space-y-2">
									<p class="font-medium text-on-surface-variant">No hay materiales para mostrar</p>
									<p class="text-sm text-outline">
										Ajusta la búsqueda o crea un nuevo material para comenzar.
									</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredMaterials as material (material.id)}
							<tr class="transition-colors hover:bg-surface-container-low">
								<td class="px-6 py-5">
									<div class="flex items-center gap-4">
										<div
											class="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-high text-brand-blue"
										>
											<FlaskConical class="h-5 w-5" />
										</div>
										<div>
											<p class="font-semibold text-on-surface">{material.name}</p>
											{#if material.description}
												<p class="mt-1 text-xs text-outline">Ficha técnica activa</p>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-6 py-5">
									<span
										class="rounded-md bg-surface-container-high px-2.5 py-1 font-mono text-xs font-semibold text-on-surface-variant"
									>
										{material.code}
									</span>
								</td>
								<td class="px-6 py-5 font-mono text-sm font-semibold text-brand-navy">
									{formatIndex(material.refractiveIndex)}
								</td>
								<td class="px-6 py-5 text-sm text-on-surface-variant">
									{material.description ?? '-'}
								</td>
								<td class="px-6 py-5 text-right">
									<AppBadge variant="success">Activo</AppBadge>
								</td>
								{#if canManage}
									<td class="px-6 py-5 text-right">
										<div class="flex items-center justify-end gap-1">
											<button
												type="button"
												onclick={() => startEdit(material)}
												class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
												title="Editar material"
											>
												<Pencil class="h-4 w-4" />
											</button>

											<button
												type="button"
												onclick={() => openDelete(material)}
												class="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
												title="Eliminar material"
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

		<div
			class="flex items-center justify-between gap-4 px-6 py-4 text-xs font-semibold tracking-[0.18em] text-outline uppercase"
		>
			<p>Mostrando {filteredMaterials.length} de {materials.length} materiales</p>
			{#if search.trim()}
				<p>Filtro activo</p>
			{/if}
		</div>
	</section>
</div>

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
