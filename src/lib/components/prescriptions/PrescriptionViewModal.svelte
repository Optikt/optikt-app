<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Trash2, Star, SquarePen } from '@lucide/svelte';
	import type { Prescription, Customer } from '$lib/server/db/schema';
	import {
		setCurrentPrescription,
		deletePrescriptionCommand
	} from '$lib/remote/prescriptions.remote';
	import { toast } from 'svelte-sonner';
	import {
		formatAxis,
		formatDate,
		formatOpticalValue,
		getErrorMessage,
		getFullName
	} from '$lib/utils';
	import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';

	interface Props {
		open: boolean;
		prescription: Prescription | null;
		customer: Customer;
		onEdit?: () => void;
		onDeleted?: () => void;
		onClose: () => void;
	}

	let { open = $bindable(), prescription, customer, onEdit, onDeleted, onClose }: Props = $props();

	let isDeleting = $state(false);
	let isSettingCurrent = $state(false);

	// Handle set as current
	async function handleSetCurrent() {
		if (!prescription || prescription.isCurrent) return;

		isSettingCurrent = true;
		try {
			const result = await setCurrentPrescription({ id: prescription.id, isCurrent: true });
			if (result.success) {
				toast.success('Fórmula marcada como actual');
				// The parent should refresh the prescription data
				onDeleted?.(); // Reuse to trigger refresh
			} else {
				toast.error(result.error ?? 'Error al actualizar fórmula');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error al actualizar fórmula'));
		} finally {
			isSettingCurrent = false;
		}
	}

	// Handle delete
	async function handleDelete() {
		if (!prescription) return;

		if (!confirm('¿Está seguro de eliminar esta fórmula? Esta acción no se puede deshacer.')) {
			return;
		}

		isDeleting = true;
		try {
			const result = await deletePrescriptionCommand({ id: prescription.id });
			if (result.success) {
				toast.success('Fórmula eliminada');
				onDeleted?.();
				onClose();
			} else {
				toast.error(result.error ?? 'Error al eliminar fórmula');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error al eliminar fórmula'));
		} finally {
			isDeleting = false;
		}
	}

	function handleClose() {
		if (isDeleting || isSettingCurrent) return;
		onClose();
	}
</script>

{#if prescription}
	<Dialog.Root
		bind:open
		onOpenChangeComplete={(o) => {
			if (!o) handleClose();
		}}
	>
		<Dialog.Content class="sm:max-w-xl">
			<Dialog.Header>
				<Dialog.Title>Detalle de Fórmula</Dialog.Title>
			</Dialog.Header>
			<div class="space-y-6">
				<!-- Customer info -->
				<div class="rounded-lg bg-slate-50 p-3">
					<p class="text-sm text-slate-600">
						Cliente: <span class="font-medium text-slate-900">{getFullName(customer)}</span>
					</p>
				</div>

				<!-- Header with date, lens type, and current badge -->
				<div class="flex items-center justify-between">
					<div class="flex gap-8">
						<div>
							<p class="text-sm text-slate-500">Fecha de Fórmula</p>
							<p class="font-medium text-slate-900">{formatDate(prescription.prescriptionDate)}</p>
						</div>
						<div>
							<p class="text-sm text-slate-500">Tipo de Lente</p>
							<p class="font-medium text-slate-900">
								{prescription.recommendedLensType
									? getLensTypeLabel(prescription.recommendedLensType)
									: '-'}
							</p>
						</div>
					</div>
					{#if prescription.isCurrent}
						<span
							class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
							>Actual</span
						>
					{/if}
				</div>

				<!-- Eye values -->
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<!-- Right Eye (OD) -->
					<div class="rounded-lg border border-slate-200 p-4">
						<h4 class="mb-3 font-semibold text-slate-900">Ojo Derecho (OD)</h4>
						<dl class="space-y-2 text-sm">
							<div class="flex justify-between">
								<dt class="text-slate-500">Esfera</dt>
								<dd class="font-medium text-slate-900">
									{formatOpticalValue(prescription.odSphere)}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-slate-500">Cilindro</dt>
								<dd class="font-medium text-slate-900">
									{formatOpticalValue(prescription.odCylinder)}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-slate-500">Eje</dt>
								<dd class="font-medium text-slate-900">{formatAxis(prescription.odAxis)}°</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-slate-500">Adición</dt>
								<dd class="font-medium text-slate-900">
									{formatOpticalValue(prescription.odAddition)}
								</dd>
							</div>
						</dl>
					</div>

					<!-- Left Eye (OS) -->
					<div class="rounded-lg border border-slate-200 p-4">
						<h4 class="mb-3 font-semibold text-slate-900">Ojo Izquierdo (OS)</h4>
						<dl class="space-y-2 text-sm">
							<div class="flex justify-between">
								<dt class="text-slate-500">Esfera</dt>
								<dd class="font-medium text-slate-900">
									{formatOpticalValue(prescription.osSphere)}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-slate-500">Cilindro</dt>
								<dd class="font-medium text-slate-900">
									{formatOpticalValue(prescription.osCylinder)}
								</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-slate-500">Eje</dt>
								<dd class="font-medium text-slate-900">{formatAxis(prescription.osAxis)}°</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-slate-500">Adición</dt>
								<dd class="font-medium text-slate-900">
									{formatOpticalValue(prescription.osAddition)}
								</dd>
							</div>
						</dl>
					</div>
				</div>

				<!-- DP/NP Section -->
				<div class="rounded-lg border border-slate-200 p-4">
					<h4 class="mb-3 font-semibold text-slate-900">Distancias</h4>
					<dl class="grid grid-cols-3 gap-4 text-sm">
						<div class="flex flex-col">
							<dt class="text-slate-500">DP (Distancia Pupilar)</dt>
							<dd class="font-medium text-slate-900">{formatOpticalValue(prescription.dp)} mm</dd>
						</div>
						<div class="flex flex-col">
							<dt class="text-slate-500">NP Derecho</dt>
							<dd class="font-medium text-slate-900">
								{formatOpticalValue(prescription.npRight)} mm
							</dd>
						</div>
						<div class="flex flex-col">
							<dt class="text-slate-500">NP Izquierdo</dt>
							<dd class="font-medium text-slate-900">
								{formatOpticalValue(prescription.npLeft)} mm
							</dd>
						</div>
					</dl>
				</div>

				<!-- Treatments Section -->
				{#if prescription.treatments}
					<div class="rounded-lg border border-slate-200 p-4">
						<h4 class="mb-3 font-semibold text-slate-900">Tratamientos</h4>
						<div class="flex flex-wrap gap-2">
							{#if prescription.treatments.antiReflective}
								<span
									class="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
									>Antireflejo</span
								>
							{/if}
							{#if prescription.treatments.blueBlock}
								<span
									class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
									>Blueblock</span
								>
							{/if}
							{#if prescription.treatments.photochromic}
								<span
									class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
									>Fotocromático</span
								>
							{/if}
							{#if prescription.treatments.other}
								<span
									class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
									>Otros: {prescription.treatments.other}</span
								>
							{/if}
							{#if !prescription.treatments.antiReflective && !prescription.treatments.blueBlock && !prescription.treatments.photochromic && !prescription.treatments.other}
								<span class="text-slate-400">-</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Additional info -->
				{#if prescription.doctorName || prescription.notes}
					<div class="space-y-3">
						{#if prescription.doctorName}
							<div>
								<p class="text-sm text-slate-500">Doctor</p>
								<p class="font-medium text-slate-900">{prescription.doctorName}</p>
							</div>
						{/if}
						{#if prescription.notes}
							<div>
								<p class="text-sm text-slate-500">Notas</p>
								<p class="whitespace-pre-wrap text-slate-900">{prescription.notes}</p>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Actions -->
				<Dialog.Footer class="flex justify-between">
					<div class="flex gap-2">
						{#if !prescription.isCurrent}
							<Button
								variant="outline"
								size="sm"
								onclick={handleSetCurrent}
								disabled={isSettingCurrent}
							>
								<Star class="me-2 h-4 w-4" />
								Marcar como actual
							</Button>
						{/if}
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={onEdit}>
							<SquarePen class="me-2 h-4 w-4" />
							Editar
						</Button>
						<Button variant="destructive" size="sm" onclick={handleDelete} disabled={isDeleting}>
							<Trash2 class="me-2 h-4 w-4" />
							Eliminar
						</Button>
					</div>
				</Dialog.Footer>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}
