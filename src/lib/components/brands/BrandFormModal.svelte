<script lang="ts">
	import { Modal, Button, Label, Input, Spinner, Textarea } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createBrandForm, updateBrandForm } from '$lib/remote/brands.remote';
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

			<div>
				<Label for="name" class="mb-2">Nombre *</Label>
				<Input
					id="name"
					name="name"
					bind:value={formData.name}
					placeholder="Ej: Ray-Ban"
					required
				/>
				{#each currentUpdateForm.fields.name?.issues() ?? [] as issue, index (`issue-update-${index}`)}
					<p class="mt-1 text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<Label for="description" class="mb-2">Descripción</Label>
				<Textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Descripción de la marca"
					rows={3}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="country" class="mb-2">País</Label>
					<Input
						id="country"
						name="country"
						bind:value={formData.country}
						placeholder="Ej: Italia"
					/>
				</div>
				<div>
					<Label for="website" class="mb-2">Sitio Web</Label>
					<Input
						id="website"
						name="website"
						bind:value={formData.website}
						placeholder="https://..."
					/>
				</div>
			</div>

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
			<div>
				<Label for="name" class="mb-2">Nombre *</Label>
				<Input
					id="name"
					name="name"
					bind:value={formData.name}
					placeholder="Ej: Ray-Ban"
					required
				/>
				{#each currentCreateForm.fields.name?.issues() ?? [] as issue, index (`issue-create-${index}`)}
					<p class="mt-1 text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<Label for="description" class="mb-2">Descripción</Label>
				<Textarea
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Descripción de la marca"
					rows={3}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="country" class="mb-2">País</Label>
					<Input
						id="country"
						name="country"
						bind:value={formData.country}
						placeholder="Ej: Italia"
					/>
				</div>
				<div>
					<Label for="website" class="mb-2">Sitio Web</Label>
					<Input
						id="website"
						name="website"
						bind:value={formData.website}
						placeholder="https://..."
					/>
				</div>
			</div>

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
