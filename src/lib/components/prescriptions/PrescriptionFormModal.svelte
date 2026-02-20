<script lang="ts">
	import { Modal, Button, Spinner, Checkbox, Label, Select } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createPrescriptionForm, updatePrescriptionForm } from '$lib/remote/prescriptions.remote';
	import { FormInput, FormDatepicker } from '$lib/components/ui';
	import { scrollToFirstError, getErrorMessage, getFullName } from '$lib/utils';
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
		// DP/NP
		dp: '' as string,
		npRight: '' as string,
		npLeft: '' as string,
		// Treatments
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		hasOtherTreatment: false,
		treatmentOther: '' as string,
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
						dp: prescription.dp?.toString() ?? '',
						npRight: prescription.npRight?.toString() ?? '',
						npLeft: prescription.npLeft?.toString() ?? '',
						treatmentAntiReflective: prescription.treatments?.antiReflective ?? false,
						treatmentBlueBlock: prescription.treatments?.blueBlock ?? false,
						treatmentPhotochromic: prescription.treatments?.photochromic ?? false,
						hasOtherTreatment: !!prescription.treatments?.other,
						treatmentOther: prescription.treatments?.other ?? '',
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
						dp: '',
						npRight: '',
						npLeft: '',
						treatmentAntiReflective: false,
						treatmentBlueBlock: false,
						treatmentPhotochromic: false,
						hasOtherTreatment: false,
						treatmentOther: '',
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

	type FormData = typeof formData;
	type FormInstance = typeof currentCreateForm | typeof currentUpdateForm;

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

<!-- Sphere Snippet (OD-OI)-->
{#snippet sphere(name: 'odSphere' | 'osSphere', data: FormData, issues: FormInstance['fields'])}
	<FormInput
		{name}
		label="Esfera"
		type="number"
		step={0.25}
		placeholder="-2.00"
		bind:value={data[name]}
		error={issues[name]?.issues()}
	/>
{/snippet}

<!-- Cylinder Snippet (OD-OI)-->
{#snippet cylinder(
	name: 'odCylinder' | 'osCylinder',
	data: FormData,
	issues: FormInstance['fields']
)}
	<FormInput
		{name}
		label="Cilindro"
		type="number"
		step={0.25}
		placeholder="-0.50"
		min={-6}
		max={0}
		bind:value={data[name]}
		error={issues[name]?.issues()}
	/>
{/snippet}

{#snippet prescriptionFields(formInstance: FormInstance)}
	<div
		class="space-y-4 direct-children:border-b-slate-200 direct-children:pb-3 direct-children:not-last:border-b"
	>
		<div class="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
			<FormDatepicker
				name="prescriptionDate"
				label="Fecha de Fórmula"
				required
				bind:value={formData.prescriptionDate}
				availableTo={new Date()}
				error={formInstance.fields.prescriptionDate?.issues()}
			/>
			<div>
				<Label for="recommendedLensType" class="mb-2">Tipo de Lente</Label>
				<Select
					id="recommendedLensType"
					name="recommendedLensType"
					items={lensTypeOptions}
					bind:value={formData.recommendedLensType}
				/>
			</div>
			<FormInput
				name="doctorName"
				label="Doctor"
				placeholder="Nombre del doctor"
				bind:value={formData.doctorName}
				error={formInstance.fields.doctorName?.issues()}
			/>
			<div class="flex h-[42px] items-center">
				<Checkbox name="isCurrent" bind:checked={formData.isCurrent}>Fórmula actual</Checkbox>
			</div>
		</div>

		<!-- Eye values section -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- Right Eye (OD) -->
			<!-- <div class="space-y-2 pr-4 border-slate-400 border-r "> -->
			<div class="space-y-2">
				<h4 class="font-semibold text-slate-900">Ojo Derecho (OD)</h4>
				<div class="grid grid-cols-2 gap-3">
					{@render sphere('odSphere', formData, formInstance.fields)}

					{@render cylinder('odCylinder', formData, formInstance.fields)}

					<FormInput
						name="odAxis"
						label="Eje"
						type="number"
						step={1}
						min={0}
						max={180}
						placeholder="180"
						bind:value={formData.odAxis}
						error={formInstance.fields.odAxis?.issues()}
					/>

					{#if !isMonofocal}
						<FormInput
							name="odAddition"
							label="Adición"
							type="number"
							step={0.25}
							placeholder="+1.50"
							bind:value={formData.odAddition}
							error={formInstance.fields.odAddition?.issues()}
						/>
					{/if}
				</div>
			</div>

			<!-- Left Eye (OS) -->
			<div class="space-y-2">
				<h4 class="font-semibold text-slate-900">Ojo Izquierdo (OS)</h4>
				<div class="grid grid-cols-2 gap-3">
					{@render sphere('osSphere', formData, formInstance.fields)}

					{@render cylinder('osCylinder', formData, formInstance.fields)}

					<FormInput
						name="osAxis"
						label="Eje"
						type="number"
						step={1}
						min={0}
						max={180}
						placeholder="180"
						bind:value={formData.osAxis}
						error={formInstance.fields.osAxis?.issues()}
					/>

					{#if !isMonofocal}
						<FormInput
							name="osAddition"
							label="Adición"
							type="number"
							step={0.25}
							placeholder="+1.50"
							bind:value={formData.osAddition}
							error={formInstance.fields.osAddition?.issues()}
						/>
					{/if}
				</div>
			</div>
		</div>

		<!-- DP/NP Section -->
		<div class="space-y-2">
			<h4 class="font-semibold text-slate-900">Distancias</h4>
			<div class="grid grid-cols-3 gap-3">
				<FormInput
					name="dp"
					label="DP (mm)"
					type="number"
					min={0}
					placeholder="62"
					bind:value={formData.dp}
					error={formInstance.fields.dp?.issues()}
				/>
				<FormInput
					name="npRight"
					label="NP Derecho (mm)"
					type="number"
					min={0}
					placeholder="31"
					bind:value={formData.npRight}
					error={formInstance.fields.npRight?.issues()}
				/>
				<FormInput
					name="npLeft"
					label="NP Izquierdo (mm)"
					type="number"
					min={0}
					placeholder="31"
					bind:value={formData.npLeft}
					error={formInstance.fields.npLeft?.issues()}
				/>
			</div>
		</div>

		<!-- Treatments Section -->
		<div class="space-y-2">
			<h4 class="font-semibold text-slate-900">Tratamientos</h4>
			<div class="flex items-start space-x-8">
				<Checkbox name="treatmentAntiReflective" bind:checked={formData.treatmentAntiReflective}>
					Antireflejo
				</Checkbox>

				<Checkbox name="treatmentBlueBlock" bind:checked={formData.treatmentBlueBlock}>
					Blueblock
				</Checkbox>

				<Checkbox name="treatmentPhotochromic" bind:checked={formData.treatmentPhotochromic}>
					Fotocromático
				</Checkbox>

				<div class="flex w-full items-start gap-3">
					<Checkbox name="treatmentOtherChecked" bind:checked={formData.hasOtherTreatment}>
						Otros
					</Checkbox>

					{#if formData.hasOtherTreatment}
						<FormInput
							divClass="w-full"
							name="treatmentOther"
							placeholder="Describa el tratamiento"
							bind:value={formData.treatmentOther}
							required
						/>
					{/if}
				</div>
			</div>
		</div>

		<!-- Notes -->
		<FormInput
			name="notes"
			label="Notas"
			placeholder="Observaciones adicionales"
			bind:value={formData.notes}
			error={formInstance.fields.notes?.issues()}
		/>
	</div>
{/snippet}

<Modal
	bind:open
	size="lg"
	title={`${title} - ${getFullName(customer)}`}
	outsideclose
	onclose={handleClose}
>
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
