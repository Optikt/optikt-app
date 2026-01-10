<script lang="ts">
	import { Modal, Button, Label, Input, Spinner, Textarea, Select } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createSupplierForm, updateSupplierForm } from '$lib/remote/suppliers.remote';
	import { SupplierType, ALL_SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS } from '$lib/shared/enums';
	import type { Supplier } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		supplier?: Supplier | null;
		onSuccess?: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), supplier = null, onSuccess, onClose }: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!supplier);
	const title = $derived(isEditMode ? 'Editar Proveedor' : 'Agregar Proveedor');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Proveedor');

	// Form data
	let formData = $state({
		name: '',
		type: SupplierType.DISTRIBUTOR as string,
		rif: '',
		primaryPhone: '',
		email: '',
		address: '',
		instagram: '',
		whatsapp: '',
		website: '',
		contactName: '',
		contactPhone: '',
		contactRole: '',
		notes: ''
	});

	// Reset form when modal opens or supplier changes
	let formInstanceId = $state(crypto.randomUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = crypto.randomUUID();
				if (supplier) {
					formData = {
						name: supplier.name ?? '',
						type: supplier.type ?? SupplierType.DISTRIBUTOR,
						rif: supplier.rif ?? '',
						primaryPhone: supplier.primaryPhone ?? '',
						email: supplier.email ?? '',
						address: supplier.address ?? '',
						instagram: supplier.instagram ?? '',
						whatsapp: supplier.whatsapp ?? '',
						website: supplier.website ?? '',
						contactName: supplier.contactName ?? '',
						contactPhone: supplier.contactPhone ?? '',
						contactRole: supplier.contactRole ?? '',
						notes: supplier.notes ?? ''
					};
				} else {
					formData = {
						name: '',
						type: SupplierType.DISTRIBUTOR,
						rif: '',
						primaryPhone: '',
						email: '',
						address: '',
						instagram: '',
						whatsapp: '',
						website: '',
						contactName: '',
						contactPhone: '',
						contactRole: '',
						notes: ''
					};
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createSupplierForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateSupplierForm.for(`${supplier?.id ?? 'new'}-${formInstanceId}`)
	);

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			return; // Stay open, show errors
		}

		toast.success('Proveedor creado exitosamente');
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

		toast.success('Proveedor actualizado');
		formEl.reset();
		open = false;
		onSuccess?.();
	}
</script>

<Modal bind:open size="lg" {title}>
	{#if isEditMode && supplier}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (e) {
					console.error(e);
					toast.error('Error actualizando proveedor');
				} finally {
					isSubmitting = false;
				}
			})}
			class="flex flex-col gap-4"
		>
			<input type="hidden" name="id" value={supplier.id} />

			<!-- Basic Info -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="name" class="mb-2">Nombre *</Label>
					<Input
						id="name"
						name="name"
						bind:value={formData.name}
						placeholder="Ej: OptiVision"
						required
					/>
					{#each currentUpdateForm.fields.name?.issues() ?? [] as issue, i (`update-name-${i}`)}
						<p class="mt-1 text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
				<div>
					<Label for="type" class="mb-2">Tipo *</Label>
					<Select id="type" name="type" bind:value={formData.type}>
						{#each ALL_SUPPLIER_TYPES as t (t)}
							<option value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
						{/each}
					</Select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="rif" class="mb-2">RIF</Label>
					<Input id="rif" name="rif" bind:value={formData.rif} placeholder="V/E/J/G-12345678-9" />
					{#each currentUpdateForm.fields.rif?.issues() ?? [] as issue, i (`update-rif-${i}`)}
						<p class="mt-1 text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
				<div>
					<Label for="primaryPhone" class="mb-2">Teléfono Principal *</Label>
					<Input
						id="primaryPhone"
						name="primaryPhone"
						bind:value={formData.primaryPhone}
						placeholder="0414-1234567"
						required
					/>
					{#each currentUpdateForm.fields.primaryPhone?.issues() ?? [] as issue, i (`update-phone-${i}`)}
						<p class="mt-1 text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="email" class="mb-2">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						bind:value={formData.email}
						placeholder="contacto@empresa.com"
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

			<div>
				<Label for="address" class="mb-2">Dirección</Label>
				<Textarea
					id="address"
					name="address"
					bind:value={formData.address}
					rows={2}
					placeholder="Dirección completa"
				/>
			</div>

			<!-- Social Media -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="instagram" class="mb-2">Instagram</Label>
					<Input
						id="instagram"
						name="instagram"
						bind:value={formData.instagram}
						placeholder="@usuario"
					/>
				</div>
				<div>
					<Label for="whatsapp" class="mb-2">WhatsApp</Label>
					<Input
						id="whatsapp"
						name="whatsapp"
						bind:value={formData.whatsapp}
						placeholder="+58 414 1234567"
					/>
				</div>
			</div>

			<!-- Contact Person -->
			<div class="border-t border-slate-200 pt-4">
				<p class="mb-3 text-sm font-medium text-slate-700">Persona de Contacto</p>
				<div class="grid grid-cols-3 gap-4">
					<div>
						<Label for="contactName" class="mb-2">Nombre</Label>
						<Input
							id="contactName"
							name="contactName"
							bind:value={formData.contactName}
							placeholder="Nombre"
						/>
					</div>
					<div>
						<Label for="contactPhone" class="mb-2">Teléfono</Label>
						<Input
							id="contactPhone"
							name="contactPhone"
							bind:value={formData.contactPhone}
							placeholder="Teléfono"
						/>
					</div>
					<div>
						<Label for="contactRole" class="mb-2">Cargo</Label>
						<Input
							id="contactRole"
							name="contactRole"
							bind:value={formData.contactRole}
							placeholder="Cargo"
						/>
					</div>
				</div>
			</div>

			<div>
				<Label for="notes" class="mb-2">Notas</Label>
				<Textarea
					id="notes"
					name="notes"
					bind:value={formData.notes}
					rows={2}
					placeholder="Notas adicionales"
				/>
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
					toast.error('Error creando proveedor');
				} finally {
					isSubmitting = false;
				}
			})}
			class="flex flex-col gap-4"
		>
			<!-- Basic Info -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="name" class="mb-2">Nombre *</Label>
					<Input
						id="name"
						name="name"
						bind:value={formData.name}
						placeholder="Ej: OptiVision"
						required
					/>
					{#each currentCreateForm.fields.name?.issues() ?? [] as issue, i (`create-name-${i}`)}
						<p class="mt-1 text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
				<div>
					<Label for="type" class="mb-2">Tipo *</Label>
					<Select id="type" name="type" bind:value={formData.type}>
						{#each ALL_SUPPLIER_TYPES as t (t)}
							<option value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
						{/each}
					</Select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="rif" class="mb-2">RIF</Label>
					<Input id="rif" name="rif" bind:value={formData.rif} placeholder="V/E/J/G-12345678-9" />
					{#each currentCreateForm.fields.rif?.issues() ?? [] as issue, i (`create-rif-${i}`)}
						<p class="mt-1 text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
				<div>
					<Label for="primaryPhone" class="mb-2">Teléfono Principal *</Label>
					<Input
						id="primaryPhone"
						name="primaryPhone"
						bind:value={formData.primaryPhone}
						placeholder="0414-1234567"
						required
					/>
					{#each currentCreateForm.fields.primaryPhone?.issues() ?? [] as issue, i (`create-phone-${i}`)}
						<p class="mt-1 text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="email" class="mb-2">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						bind:value={formData.email}
						placeholder="contacto@empresa.com"
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

			<div>
				<Label for="address" class="mb-2">Dirección</Label>
				<Textarea
					id="address"
					name="address"
					bind:value={formData.address}
					rows={2}
					placeholder="Dirección completa"
				/>
			</div>

			<!-- Social Media -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="instagram" class="mb-2">Instagram</Label>
					<Input
						id="instagram"
						name="instagram"
						bind:value={formData.instagram}
						placeholder="@usuario"
					/>
				</div>
				<div>
					<Label for="whatsapp" class="mb-2">WhatsApp</Label>
					<Input
						id="whatsapp"
						name="whatsapp"
						bind:value={formData.whatsapp}
						placeholder="+58 414 1234567"
					/>
				</div>
			</div>

			<!-- Contact Person -->
			<div class="border-t border-slate-200 pt-4">
				<p class="mb-3 text-sm font-medium text-slate-700">Persona de Contacto</p>
				<div class="grid grid-cols-3 gap-4">
					<div>
						<Label for="contactName" class="mb-2">Nombre</Label>
						<Input
							id="contactName"
							name="contactName"
							bind:value={formData.contactName}
							placeholder="Nombre"
						/>
					</div>
					<div>
						<Label for="contactPhone" class="mb-2">Teléfono</Label>
						<Input
							id="contactPhone"
							name="contactPhone"
							bind:value={formData.contactPhone}
							placeholder="Teléfono"
						/>
					</div>
					<div>
						<Label for="contactRole" class="mb-2">Cargo</Label>
						<Input
							id="contactRole"
							name="contactRole"
							bind:value={formData.contactRole}
							placeholder="Cargo"
						/>
					</div>
				</div>
			</div>

			<div>
				<Label for="notes" class="mb-2">Notas</Label>
				<Textarea
					id="notes"
					name="notes"
					bind:value={formData.notes}
					rows={2}
					placeholder="Notas adicionales"
				/>
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
