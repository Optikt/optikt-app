<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createMaterialForm, updateMaterialForm } from '$lib/remote/materials.remote';
	import { FormInput, FormTextarea } from '$lib/components/ui';
	import MaterialReactivateModal from './MaterialReactivateModal.svelte';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { toastUnboundErrors } from '$lib/utils';
	import type { Material } from '$lib/server/db/schema';
	import type { CreateEntityResult } from '$lib/types';
	import { MATERIAL_CATEGORIES, MATERIAL_CATEGORY_LABELS } from '$lib/shared/enums/productTypes';

	interface Props {
		open: boolean;
		material?: Material | null;
		onSuccess?: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), material = null, onSuccess, onClose }: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!material);
	const title = $derived(isEditMode ? 'Editar Material' : 'Agregar Material');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Material');

	// Form data
	let formData = $state({
		name: '',
		code: '',
		productType: 'FRAME',
		description: ''
	});

	// Reactivation modal state
	let showReactivateModal = $state(false);
	let reactivationCandidate = $state<Material | null>(null);

	// Reset form when modal opens or material changes
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = generateUUID();
				if (material) {
					formData = {
						name: material.name ?? '',
						code: material.code ?? '',
						productType: material.productType ?? 'FRAME',
						description: material.description ?? ''
					};
				} else {
					formData = {
						name: '',
						code: '',
						productType: 'FRAME',
						description: ''
					};
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createMaterialForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateMaterialForm.for(`${material?.id ?? 'new'}-${formInstanceId}`)
	);

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return; // Stay open, show errors
		}

		const result = currentCreateForm.result as CreateEntityResult<Material> | undefined;

		// Check for reactivation candidate
		if (result && !result.success && result.reactivationCandidate) {
			// Show reactivation confirmation modal
			reactivationCandidate = result.reactivationCandidate;
			showReactivateModal = true;
			return;
		}

		// Success - close and refresh
		toast.success('Material creado exitosamente');
		formEl.reset();
		open = false;
		onSuccess?.();
	}

	// Handle update result
	function handleUpdateResult(formEl: HTMLFormElement) {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return; // Stay open, show errors
		}

		toast.success('Material actualizado');
		formEl.reset();
		open = false;
		onSuccess?.();
	}

	// Handle reactivation success
	function handleReactivationSuccess() {
		showReactivateModal = false;
		reactivationCandidate = null;
		open = false;
		onSuccess?.();
	}
</script>

<Modal bind:open size="md" {title}>
	{#if isEditMode && material}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (e) {
					console.error(e);
					toast.error('Error actualizando material');
				} finally {
					isSubmitting = false;
				}
			})}
			class="flex flex-col gap-4"
		>
			<input type="hidden" name="id" value={material.id} />

			<FormInput
				label="Nombre *"
				name="name"
				bind:value={formData.name}
				placeholder="Ej: Titanio"
				error={currentUpdateForm.fields.name?.issues()}
			/>

			<FormInput
				label="Código *"
				name="code"
				bind:value={formData.code}
				placeholder="Ej: FRM_TITANIUM"
				error={currentUpdateForm.fields.code?.issues()}
			/>

			<div>
				<label for="productType" class="mb-2 block text-sm font-medium text-gray-900">
					Tipo de Producto *
				</label>
				<select
					id="productType"
					name="productType"
					bind:value={formData.productType}
					class="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
				>
					{#each MATERIAL_CATEGORIES as type (type)}
						<option value={type}>{MATERIAL_CATEGORY_LABELS[type]}</option>
					{/each}
				</select>
			</div>

			<FormTextarea
				label="Descripción"
				name="description"
				bind:value={formData.description}
				placeholder="Descripción del material"
				rows={3}
			/>

			<div class="flex justify-end gap-2 pt-4">
				<Button color="light" onclick={onClose}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{:else}
		<!-- CREATE FORM -->
		<form
			{...currentCreateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleCreateResult(formEl);
				} catch (e) {
					console.error(e);
					toast.error('Error creando material');
				} finally {
					isSubmitting = false;
				}
			})}
			class="flex flex-col gap-4"
		>
			<FormInput
				label="Nombre *"
				name="name"
				bind:value={formData.name}
				placeholder="Ej: Titanio"
				error={currentCreateForm.fields.name?.issues()}
			/>

			<FormInput
				label="Código *"
				name="code"
				bind:value={formData.code}
				placeholder="Ej: FRM_TITANIUM"
				error={currentCreateForm.fields.code?.issues()}
			/>

			<div>
				<label for="productType" class="mb-2 block text-sm font-medium text-gray-900">
					Tipo de Producto *
				</label>
				<select
					id="productType"
					name="productType"
					bind:value={formData.productType}
					class="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
				>
					{#each MATERIAL_CATEGORIES as type (type)}
						<option value={type}>{MATERIAL_CATEGORY_LABELS[type]}</option>
					{/each}
				</select>
			</div>

			<FormTextarea
				label="Descripción"
				name="description"
				bind:value={formData.description}
				placeholder="Descripción del material"
				rows={3}
			/>

			<div class="flex justify-end gap-2 pt-4">
				<Button color="light" onclick={onClose}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Reactivate Confirmation Modal -->
<MaterialReactivateModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	onSuccess={handleReactivationSuccess}
/>
