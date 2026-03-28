<script lang="ts">
	import { Modal, Button, Spinner, Select, Label, Input, Checkbox } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import {
		createSupplierForm,
		updateSupplierForm,
		getSupplierTreatmentDefaults
	} from '$lib/remote/suppliers.remote';
	import { SupplierType, ALL_SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS } from '$lib/shared/enums';
	import {
		CORE_LENS_TREATMENT_CODES,
		LensTreatmentAvailability,
		LENS_TREATMENT_LABELS,
		LENS_TREATMENT_AVAILABILITY_LABELS,
		createDefaultTreatmentPolicies,
		toTreatmentPolicy,
		type LensTreatmentPolicy
	} from '$lib/shared/contracts';
	import {
		FormInput,
		FormTextarea,
		RifInput,
		WhatsAppInput,
		InstagramInput
	} from '$lib/components/ui';
	import { scrollToFirstError } from '$lib/utils';
	import type { Supplier } from '$lib/server/db/schema';
	import { generateUUID } from '$lib/utils/generateUUID';
	import SupplierReactivateModal from './SupplierReactivateModal.svelte';
	import type { CreateSupplierResult } from '$lib/remote/suppliers.remote';

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

	// Reactivation modal state
	let showReactivateModal = $state(false);
	let reactivationCandidate = $state<Supplier | null>(null);

	// Treatment defaults state
	let treatmentDefaults = $state<LensTreatmentPolicy[]>(createDefaultTreatmentPolicies());

	/** Serialized treatment policies for the hidden form input */
	const serializedTreatmentPolicies = $derived(JSON.stringify(treatmentDefaults));

	// Reset form when modal opens or supplier changes
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = generateUUID();
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
					loadTreatmentDefaults(supplier.id);
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
					treatmentDefaults = createDefaultTreatmentPolicies();
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createSupplierForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateSupplierForm.for(`${supplier?.id ?? 'new'}-${formInstanceId}`)
	);

	// Load treatment defaults for an existing supplier
	async function loadTreatmentDefaults(supplierId: string) {
		try {
			const rows = await getSupplierTreatmentDefaults({ supplierId });
			treatmentDefaults = CORE_LENS_TREATMENT_CODES.map((code) => {
				const row = rows.find((r) => r.code === code);
				return row
					? toTreatmentPolicy(code, {
							availability: row.availability as LensTreatmentAvailability,
							additionalPrice: row.additionalPrice,
							requiresConfirmation: row.requiresConfirmation
						})
					: toTreatmentPolicy(code);
			});
		} catch (e) {
			console.error(e);
			treatmentDefaults = createDefaultTreatmentPolicies();
		}
	}

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}

		const result = currentCreateForm.result as CreateSupplierResult | undefined;

		// Check for reactivation candidate
		if (result && !result.success && result.reactivationCandidate) {
			// Show reactivation confirmation modal
			reactivationCandidate = result.reactivationCandidate;
			showReactivateModal = true;
			return;
		}

		// Success - close and refresh
		toast.success('Proveedor creado exitosamente');
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
			<input type="hidden" name="treatmentPolicies" value={serializedTreatmentPolicies} />

			<!-- Basic Info -->
			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Nombre *"
					name="name"
					required
					bind:value={formData.name}
					placeholder="Ej: OptiVision"
					error={currentUpdateForm.fields.name?.issues()}
				/>
				<div>
					<Label for="type" class="mb-2">Tipo *</Label>
					<Select id="type" name="type" bind:value={formData.type} required>
						{#each ALL_SUPPLIER_TYPES as t (t)}
							<option value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
						{/each}
					</Select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<RifInput
					label="RIF"
					name="rif"
					bind:value={formData.rif}
					error={currentUpdateForm.fields.rif?.issues()?.[0]?.message}
				/>
				<FormInput
					label="Teléfono Principal *"
					name="primaryPhone"
					type="tel"
					required
					bind:value={formData.primaryPhone}
					placeholder="0414-1234567"
					error={currentUpdateForm.fields.primaryPhone?.issues()}
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
				<InstagramInput
					label="Instagram"
					name="instagram"
					bind:value={formData.instagram}
					error={currentUpdateForm.fields.instagram?.issues()?.[0]?.message}
				/>
				<WhatsAppInput
					label="WhatsApp"
					name="whatsapp"
					bind:value={formData.whatsapp}
					error={currentUpdateForm.fields.whatsapp?.issues()?.[0]?.message}
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

			{@render treatmentDefaultsSection()}

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
			<input type="hidden" name="treatmentPolicies" value={serializedTreatmentPolicies} />

			<!-- Basic Info -->
			<div class="grid grid-cols-2 gap-4">
				<FormInput
					label="Nombre *"
					required
					name="name"
					bind:value={formData.name}
					placeholder="Ej: OptiVision"
					error={currentCreateForm.fields.name?.issues()}
				/>
				<div>
					<Label for="type" class="mb-2">Tipo *</Label>
					<Select id="type" name="type" bind:value={formData.type} required>
						{#each ALL_SUPPLIER_TYPES as t (t)}
							<option value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
						{/each}
					</Select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<RifInput
					label="RIF"
					name="rif"
					bind:value={formData.rif}
					error={currentCreateForm.fields.rif?.issues()?.[0]?.message}
				/>
				<FormInput
					label="Teléfono Principal *"
					name="primaryPhone"
					type="tel"
					required
					bind:value={formData.primaryPhone}
					placeholder="0414-1234567"
					error={currentCreateForm.fields.primaryPhone?.issues()}
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
				<InstagramInput
					label="Instagram"
					name="instagram"
					bind:value={formData.instagram}
					error={currentCreateForm.fields.instagram?.issues()?.[0]?.message}
				/>
				<WhatsAppInput
					label="WhatsApp"
					name="whatsapp"
					bind:value={formData.whatsapp}
					error={currentCreateForm.fields.whatsapp?.issues()?.[0]?.message}
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

			{@render treatmentDefaultsSection()}

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

{#snippet treatmentDefaultsSection()}
	<div class="border-t border-slate-200 pt-4">
		<p class="mb-3 text-sm font-medium text-slate-700">Políticas de Tratamiento por Defecto</p>
		<p class="mb-3 text-xs text-slate-400">
			Define los tratamientos disponibles para los cristales de este proveedor
		</p>
		<div class="space-y-3">
			{#each treatmentDefaults as policy, pi (policy.code)}
				<div class="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
					<div class="mb-2">
						<span class="text-sm font-semibold text-slate-700">
							{LENS_TREATMENT_LABELS[policy.code] ?? policy.code}
						</span>
					</div>
					<div class="grid gap-2 sm:grid-cols-3">
						{#each Object.values(LensTreatmentAvailability) as avail (avail)}
							<button
								type="button"
								class="rounded-md border-2 px-3 py-1.5 text-xs transition-all {policy.availability ===
								avail
									? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
									: 'border-slate-200 text-slate-600 hover:border-slate-300'}"
								onclick={() => (treatmentDefaults[pi].availability = avail)}
							>
								{LENS_TREATMENT_AVAILABILITY_LABELS[avail]}
							</button>
						{/each}
					</div>
					{#if policy.availability === LensTreatmentAvailability.OPTIONAL_EXTRA}
						<div class="mt-2 grid gap-3 sm:grid-cols-2">
							<div>
								<Label class="mb-1 text-xs text-slate-500">Precio adicional ($)</Label>
								<Input
									bind:value={treatmentDefaults[pi].additionalPrice}
									type="number"
									step="0.1"
									min="0"
									size="sm"
									class="font-mono"
								/>
							</div>
							<div class="flex items-end">
								<Checkbox bind:checked={treatmentDefaults[pi].requiresConfirmation}>
									<span class="text-xs text-slate-600">Requiere confirmación</span>
								</Checkbox>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/snippet}

<!-- Reactivate Confirmation Modal -->
<SupplierReactivateModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	onSuccess={handleReactivationSuccess}
/>
