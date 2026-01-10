<script lang="ts">
	import { Modal, Button, Spinner, Select, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createSupplierForm, updateSupplierForm } from '$lib/remote/suppliers.remote';
	import { SupplierType, ALL_SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS } from '$lib/shared/enums';
	import { FormInput, FormTextarea } from '$lib/components/ui';
	import { scrollToFirstError } from '$lib/utils';
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
			scrollToFirstError();
			return;
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
			scrollToFirstError();
			return;
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
				<FormInput
					label="Nombre *"
					name="name"
					bind:value={formData.name}
					placeholder="Ej: OptiVision"
					issues={currentUpdateForm.fields.name?.issues()}
				/>
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
				<FormInput
					label="RIF"
					name="rif"
					bind:value={formData.rif}
					placeholder="V/E/J/G-12345678-9"
					issues={currentUpdateForm.fields.rif?.issues()}
				/>
				<FormInput
					label="Teléfono Principal *"
					name="primaryPhone"
					type="tel"
					bind:value={formData.primaryPhone}
					placeholder="0414-1234567"
					issues={currentUpdateForm.fields.primaryPhone?.issues()}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Email"
					name="email"
					type="email"
					bind:value={formData.email}
					placeholder="contacto@empresa.com"
				/>
				<FormInput
					label="Sitio Web"
					name="website"
					type="url"
					bind:value={formData.website}
					placeholder="https://..."
				/>
			</div>

			<FormTextarea
				label="Dirección"
				name="address"
				bind:value={formData.address}
				rows={2}
				placeholder="Dirección completa"
			/>

			<!-- Social Media -->
			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Instagram"
					name="instagram"
					bind:value={formData.instagram}
					placeholder="@usuario"
				/>
				<FormInput
					label="WhatsApp"
					name="whatsapp"
					bind:value={formData.whatsapp}
					placeholder="+58 414 1234567"
				/>
			</div>

			<!-- Contact Person -->
			<div class="border-t border-slate-200 pt-4">
				<p class="mb-3 text-sm font-medium text-slate-700">Persona de Contacto</p>
				<div class="grid grid-cols-3 gap-4">
					<FormInput
						label="Nombre"
						name="contactName"
						bind:value={formData.contactName}
						placeholder="Nombre"
					/>
					<FormInput
						label="Teléfono"
						name="contactPhone"
						type="tel"
						bind:value={formData.contactPhone}
						placeholder="Teléfono"
					/>
					<FormInput
						label="Cargo"
						name="contactRole"
						bind:value={formData.contactRole}
						placeholder="Cargo"
					/>
				</div>
			</div>

			<FormTextarea
				label="Notas"
				name="notes"
				bind:value={formData.notes}
				rows={2}
				placeholder="Notas adicionales"
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
					toast.error('Error creando proveedor');
				} finally {
					isSubmitting = false;
				}
			})}
			class="flex flex-col gap-4"
		>
			<!-- Basic Info -->
			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Nombre *"
					name="name"
					bind:value={formData.name}
					placeholder="Ej: OptiVision"
					issues={currentCreateForm.fields.name?.issues()}
				/>
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
				<FormInput
					label="RIF"
					name="rif"
					bind:value={formData.rif}
					placeholder="V/E/J/G-12345678-9"
					issues={currentCreateForm.fields.rif?.issues()}
				/>
				<FormInput
					label="Teléfono Principal *"
					name="primaryPhone"
					type="tel"
					bind:value={formData.primaryPhone}
					placeholder="0414-1234567"
					issues={currentCreateForm.fields.primaryPhone?.issues()}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Email"
					name="email"
					type="email"
					bind:value={formData.email}
					placeholder="contacto@empresa.com"
				/>
				<FormInput
					label="Sitio Web"
					name="website"
					type="url"
					bind:value={formData.website}
					placeholder="https://..."
				/>
			</div>

			<FormTextarea
				label="Dirección"
				name="address"
				bind:value={formData.address}
				rows={2}
				placeholder="Dirección completa"
			/>

			<!-- Social Media -->
			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Instagram"
					name="instagram"
					bind:value={formData.instagram}
					placeholder="@usuario"
				/>
				<FormInput
					label="WhatsApp"
					name="whatsapp"
					bind:value={formData.whatsapp}
					placeholder="+58 414 1234567"
				/>
			</div>

			<!-- Contact Person -->
			<div class="border-t border-slate-200 pt-4">
				<p class="mb-3 text-sm font-medium text-slate-700">Persona de Contacto</p>
				<div class="grid grid-cols-3 gap-4">
					<FormInput
						label="Nombre"
						name="contactName"
						bind:value={formData.contactName}
						placeholder="Nombre"
					/>
					<FormInput
						label="Teléfono"
						name="contactPhone"
						type="tel"
						bind:value={formData.contactPhone}
						placeholder="Teléfono"
					/>
					<FormInput
						label="Cargo"
						name="contactRole"
						bind:value={formData.contactRole}
						placeholder="Cargo"
					/>
				</div>
			</div>

			<FormTextarea
				label="Notas"
				name="notes"
				bind:value={formData.notes}
				rows={2}
				placeholder="Notas adicionales"
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
