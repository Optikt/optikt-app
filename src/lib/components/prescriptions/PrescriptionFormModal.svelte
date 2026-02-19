<script lang="ts">
	import { Modal, Button, Spinner, Checkbox, Label, Select } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createPrescriptionForm, updatePrescriptionForm } from '$lib/remote/prescriptions.remote';
	import { FormInput, FormDatepicker } from '$lib/components/ui';
	import { scrollToFirstError, getErrorMessage } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { LensType, ALL_LENS_TYPES, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import type { Prescription, Customer } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		customer: Customer;
		prescription?: Prescription | null;
		onSuccess?: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), customer, prescription = null, onSuccess, onClose }: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!prescription);
	const title = $derived(isEditMode ? 'Editar Fórmula' : 'Nueva Fórmula');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Fórmula');

	// Lens type options for select (no empty option - defaults to MONOFOCAL)
	const lensTypeOptions = ALL_LENS_TYPES.map((type) => ({
		value: type,
		name: getLensTypeLabel(type)
	}));

	// Form data
	let formData = $state({
		prescriptionDate: undefined as Date | undefined,
		recommendedLensType: LensType.MONOFOCAL as string,
		// Right eye (OD)
		odSphere: '' as string,
		odCylinder: '' as string,
		odAxis: '' as string,
		odAddition: '' as string,
		// Left eye (OS)
		osSphere: '' as string,
		osCylinder: '' as string,
		osAxis: '' as string,
		osAddition: '' as string,
		// PD
		pd: '' as string,
		pdRight: '' as string,
		pdLeft: '' as string,
		// Additional
		doctorName: '',
		notes: '',
		isCurrent: false
	});

	// Derived: whether addition fields should be disabled
	const isMonofocal = $derived(formData.recommendedLensType === LensType.MONOFOCAL);

	// Clear addition values when switching to monofocal
	$effect(() => {
		if (isMonofocal) {
			untrack(() => {
				formData.odAddition = '';
				formData.osAddition = '';
			});
		}
	});

	// Max date for prescription date picker (no future dates)
	const today = new Date();

	// Reset form when modal opens
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = generateUUID();
				if (prescription) {
					formData = {
						prescriptionDate: prescription.prescriptionDate
							? new Date(prescription.prescriptionDate)
							: undefined,
						recommendedLensType: prescription.recommendedLensType ?? LensType.MONOFOCAL,
						odSphere: prescription.odSphere?.toString() ?? '',
						odCylinder: prescription.odCylinder?.toString() ?? '',
						odAxis: prescription.odAxis?.toString() ?? '',
						odAddition: prescription.odAddition?.toString() ?? '',
						osSphere: prescription.osSphere?.toString() ?? '',
						osCylinder: prescription.osCylinder?.toString() ?? '',
						osAxis: prescription.osAxis?.toString() ?? '',
						osAddition: prescription.osAddition?.toString() ?? '',
						pd: prescription.pd?.toString() ?? '',
						pdRight: prescription.pdRight?.toString() ?? '',
						pdLeft: prescription.pdLeft?.toString() ?? '',
						doctorName: prescription.doctorName ?? '',
						notes: prescription.notes ?? '',
						isCurrent: prescription.isCurrent ?? false
					};
				} else {
					formData = {
						prescriptionDate: new Date(),
						recommendedLensType: LensType.MONOFOCAL,
						odSphere: '',
						odCylinder: '',
						odAxis: '',
						odAddition: '',
						osSphere: '',
						osCylinder: '',
						osAxis: '',
						osAddition: '',
						pd: '',
						pdRight: '',
						pdLeft: '',
						doctorName: '',
						notes: '',
						isCurrent: true
					};
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createPrescriptionForm.for(formInstanceId));
	const currentUpdateForm = $derived(
		updatePrescriptionForm.for(`${prescription?.id ?? 'new'}-${formInstanceId}`)
	);

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			return;
		}

		toast.success('Fórmula creada correctamente');
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

		toast.success('Fórmula actualizada correctamente');
		formEl.reset();
		open = false;
		onSuccess?.();
	}

	function handleClose() {
		if (isSubmitting) return;
		onClose();
	}
</script>

{#snippet prescriptionFields(formInstance: typeof currentCreateForm | typeof currentUpdateForm)}
	<div class="space-y-4">
		<!-- Customer info -->
		<div class="rounded-lg bg-slate-50 p-3">
			<p class="text-sm text-slate-600">
				Cliente: <span class="font-medium text-slate-900"
					>{customer.firstName} {customer.lastName}</span
				>
			</p>
		</div>

		<!-- Prescription Date + Lens Type -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<FormDatepicker
				name="prescriptionDate"
				label="Fecha de Fórmula"
				required
				bind:value={formData.prescriptionDate}
				availableTo={today}
				error={formInstance.fields.prescriptionDate?.issues()}
			/>
			<div>
				<Label for="recommendedLensType" class="mb-2">Tipo de Lente</Label>
				<Select
					id="recommendedLensType"
					name="recommendedLensType"
					items={lensTypeOptions}
					bind:value={formData.recommendedLensType}
					class="mt-1"
				/>
			</div>
		</div>

		<!-- Eye values section -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- Right Eye (OD) -->
			<div class="space-y-3">
				<h4 class="font-semibold text-slate-900">Ojo Derecho (OD)</h4>
				<div class="grid grid-cols-2 gap-3">
					<FormInput
						name="odSphere"
						label="Esfera"
						type="number"
						step="0.25"
						placeholder="-2.00"
						bind:value={formData.odSphere}
					/>
					<FormInput
						name="odCylinder"
						label="Cilindro"
						type="number"
						step="0.25"
						placeholder="-0.50"
						bind:value={formData.odCylinder}
					/>
					<FormInput
						name="odAxis"
						label="Eje"
						type="number"
						step="1"
						placeholder="180"
						bind:value={formData.odAxis}
					/>
					{#if !isMonofocal}
						<FormInput
							name="odAddition"
							label="Adición"
							type="number"
							step="0.25"
							placeholder="+1.50"
							bind:value={formData.odAddition}
						/>
					{/if}
				</div>
			</div>

			<!-- Left Eye (OS) -->
			<div class="space-y-3">
				<h4 class="font-semibold text-slate-900">Ojo Izquierdo (OS)</h4>
				<div class="grid grid-cols-2 gap-3">
					<FormInput
						name="osSphere"
						label="Esfera"
						type="number"
						step="0.25"
						placeholder="-2.00"
						bind:value={formData.osSphere}
					/>
					<FormInput
						name="osCylinder"
						label="Cilindro"
						type="number"
						step="0.25"
						placeholder="-0.50"
						bind:value={formData.osCylinder}
					/>
					<FormInput
						name="osAxis"
						label="Eje"
						type="number"
						step="1"
						placeholder="180"
						bind:value={formData.osAxis}
					/>
					{#if !isMonofocal}
						<FormInput
							name="osAddition"
							label="Adición"
							type="number"
							step="0.25"
							placeholder="+1.50"
							bind:value={formData.osAddition}
						/>
					{/if}
				</div>
			</div>
		</div>

		<!-- PD Section -->
		<div class="space-y-3">
			<h4 class="font-semibold text-slate-900">Distancia Pupilar (PD)</h4>
			<div class="grid grid-cols-3 gap-3">
				<FormInput
					name="pd"
					label="PD Total"
					type="number"
					step="0.5"
					placeholder="62"
					bind:value={formData.pd}
				/>
				<FormInput
					name="pdRight"
					label="PD Derecho"
					type="number"
					step="0.5"
					placeholder="31"
					bind:value={formData.pdRight}
				/>
				<FormInput
					name="pdLeft"
					label="PD Izquierdo"
					type="number"
					step="0.5"
					placeholder="31"
					bind:value={formData.pdLeft}
				/>
			</div>
		</div>

		<!-- Additional info -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<FormInput
				name="doctorName"
				label="Doctor"
				placeholder="Nombre del doctor"
				bind:value={formData.doctorName}
			/>
			<div class="flex items-end pb-2">
				<Checkbox name="isCurrent" bind:checked={formData.isCurrent}>Fórmula actual</Checkbox>
			</div>
		</div>

		<!-- Notes -->
		<FormInput
			name="notes"
			label="Notas"
			placeholder="Observaciones adicionales"
			bind:value={formData.notes}
		/>
	</div>
{/snippet}

<Modal bind:open size="xl" {title} outsideclose onclose={handleClose}>
	{#if isEditMode && prescription}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (error) {
					console.error(error);
					toast.error(getErrorMessage(error, 'Error al guardar la fórmula'));
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<input type="hidden" name="id" value={prescription.id} />
			<input type="hidden" name="customerId" value={customer.id} />

			{@render prescriptionFields(currentUpdateForm)}

			<!-- Form Actions -->
			<div class="flex justify-end gap-3">
				<Button color="alternative" onclick={handleClose} disabled={isSubmitting}>Cancelar</Button>
				<Button type="submit" color="primary" disabled={isSubmitting}>
					{#if isSubmitting}
						<Spinner size="4" class="me-2" />
					{/if}
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
				} catch (error) {
					console.error(error);
					toast.error(getErrorMessage(error, 'Error al guardar la fórmula'));
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-6"
		>
			<input type="hidden" name="customerId" value={customer.id} />

			{@render prescriptionFields(currentCreateForm)}

			<!-- Form Actions -->
			<div class="flex justify-end gap-3">
				<Button color="alternative" onclick={handleClose} disabled={isSubmitting}>Cancelar</Button>
				<Button type="submit" color="primary" disabled={isSubmitting}>
					{#if isSubmitting}
						<Spinner size="4" class="me-2" />
					{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{/if}
</Modal>
