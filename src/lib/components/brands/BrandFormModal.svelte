<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createBrandForm, updateBrandForm } from '$lib/remote/brands.remote';
	import { FormInput, FormTextarea } from '$lib/components/ui';
	import type { Brand } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		brand?: Brand | null;
		onSuccess?: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), brand = null, onSuccess, onClose }: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!brand);
	const title = $derived(isEditMode ? 'Editar Marca' : 'Agregar Marca');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Marca');

	// Form data
	let formData = $state({
		name: '',
		description: '',
		country: '',
		website: ''
	});

	// Reset form when modal opens or brand changes
	let formInstanceId = $state(crypto.randomUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = crypto.randomUUID();
				if (brand) {
					formData = {
						name: brand.name ?? '',
						description: brand.description ?? '',
						country: brand.country ?? '',
						website: brand.website ?? ''
					};
				} else {
					formData = { name: '', description: '', country: '', website: '' };
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createBrandForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateBrandForm.for(`${brand?.id ?? 'new'}-${formInstanceId}`)
	);

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			return; // Stay open, show errors
		}

		toast.success('Marca creada exitosamente');
		formEl.reset();
		open = false;
		onSuccess?.();
	}

	// Handle update result
	function handleUpdateResult(formEl: HTMLFormElement) {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			return; // Stay open, show errors
		}

		toast.success('Marca actualizada');
		formEl.reset();
		open = false;
		onSuccess?.();
	}
</script>

<Modal bind:open size="md" {title}>
	{#if isEditMode && brand}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (e) {
					console.error(e);
					toast.error('Error actualizando marca');
				} finally {
					isSubmitting = false;
				}
			})}
			class="flex flex-col gap-4"
		>
			<input type="hidden" name="id" value={brand.id} />

			<FormInput
				label="Nombre *"
				name="name"
				bind:value={formData.name}
				placeholder="Ej: Ray-Ban"
				issues={currentUpdateForm.fields.name?.issues()}
			/>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<FormInput
						label="País"
						name="country"
						bind:value={formData.country}
						placeholder="Ej: Italia"
					/>
				</div>
				<div>
					<FormInput
						label="Sitio Web"
						name="website"
						type="url"
						bind:value={formData.website}
						placeholder="https://..."
					/>
				</div>
			</div>

			<FormTextarea
				label="Descripción"
				name="description"
				bind:value={formData.description}
				placeholder="Descripción de la marca"
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
					toast.error('Error creando marca');
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
				placeholder="Ej: Ray-Ban"
				issues={currentCreateForm.fields.name?.issues()}
			/>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<FormInput
						label="País"
						name="country"
						bind:value={formData.country}
						placeholder="Ej: Italia"
					/>
				</div>
				<div>
					<FormInput
						label="Sitio Web"
						name="website"
						type="url"
						bind:value={formData.website}
						placeholder="https://..."
					/>
				</div>
			</div>

			<FormTextarea
				label="Descripción"
				name="description"
				bind:value={formData.description}
				placeholder="Descripción de la marca"
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
