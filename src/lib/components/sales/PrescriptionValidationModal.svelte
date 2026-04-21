<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { AlertTriangle, CheckCircle2, CircleAlert, FlaskConical } from '@lucide/svelte';
	import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import type {
		LensConfirmationEyeResult,
		LensConfirmationItemResult,
		Step2PrescriptionConfirmation
	} from './saleItemHelpers';

	interface Props {
		open: boolean;
		confirmation: Step2PrescriptionConfirmation;
		workflowLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		confirmation,
		workflowLabel = 'operación',
		onConfirm,
		onCancel
	}: Props = $props();

	function handleClose() {
		onCancel();
	}

	function handleConfirm() {
		onConfirm();
	}

	function getTypeStatusClasses(item: LensConfirmationItemResult): string {
		return item.typeMatches
			? 'border-emerald-200 bg-emerald-50 text-emerald-900'
			: 'border-amber-200 bg-amber-50 text-amber-950';
	}

	function getTypeStatusLabel(item: LensConfirmationItemResult): string {
		return item.typeMatches ? 'Coincide con la prescripción' : 'No coincide con la prescripción';
	}

	function getEyeStatusClasses(eye: LensConfirmationEyeResult): string {
		if (eye.status === 'in-range') {
			return 'border-emerald-200 bg-emerald-50 text-emerald-900';
		}

		if (eye.status === 'out-of-range') {
			return 'border-amber-200 bg-amber-50 text-amber-950';
		}

		return 'border-slate-200 bg-slate-100 text-slate-800';
	}

	function getEyeStatusLabel(eye: LensConfirmationEyeResult): string {
		if (eye.status === 'in-range') return 'Dentro de rango';
		if (eye.status === 'out-of-range') return 'Revisar rango';
		return 'Consultar laboratorio';
	}
</script>

<Modal
	bind:open
	size="lg"
	title="Confirmar revisión óptica"
	permanent
	onclose={handleClose}
>
	<div class="space-y-4">
		<div class="rounded-[1.25rem] border border-slate-200 bg-surface-container-low px-4 py-4">
			<p class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase">
				Antes del resumen
			</p>
			<h3 class="mt-2 text-lg font-semibold text-brand-navy">
				Haz una revisión final antes de continuar
			</h3>
			<p class="mt-2 text-sm leading-6 text-on-surface-variant">
				{#if confirmation.hasLensItems}
					Confirma que la fórmula ingresada para esta {workflowLabel} corresponde al cristal
					seleccionado y que encaja con el catálogo cuando existan rangos ópticos cargados.
				{:else}
					Esta {workflowLabel} no incluye cristales. No hay validación óptica pendiente, pero
					dejamos esta confirmación antes de pasar al resumen.
				{/if}
			</p>
		</div>

		{#if confirmation.hasMultipleLenses}
			<div
				class="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
			>
				<div class="flex items-start gap-3">
					<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
					<div>
						<p class="text-sm font-semibold">Múltiples lentes en una misma operación</p>
						<p class="mt-1 text-sm leading-6 text-amber-900">
							No es el caso habitual. Normalmente conviene separar cada par en ventas o
							presupuestos distintos, aunque puedes continuar si este caso lo requiere.
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if !confirmation.hasLensItems}
			<div class="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
				<div class="flex items-start gap-3">
					<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
					<div>
						<p class="text-sm font-semibold text-brand-navy">Sin validación óptica pendiente</p>
						<p class="mt-1 text-sm leading-6 text-on-surface-variant">
							Solo hay productos o artículos no ópticos en esta operación. Puedes continuar al
							resumen sin más revisión técnica en este paso.
						</p>
					</div>
				</div>
			</div>
		{:else}
			<div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
				{#each confirmation.items as item, index (item.itemId)}
					<div class="rounded-[1rem] border border-slate-200 bg-white p-4 shadow-sm">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<p class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase">
									Cristal {index + 1}
								</p>
								<h4 class="mt-1 text-base font-semibold text-brand-navy">{item.lensName}</h4>
							</div>
							<span
								class="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant"
							>
								{item.eyes.length} {item.eyes.length === 1 ? 'ojo validado' : 'ojos validados'}
							</span>
						</div>

						<div class="mt-4 grid gap-3 lg:grid-cols-2">
							<div class={`rounded-[0.9rem] border px-4 py-3 ${getTypeStatusClasses(item)}`}>
								<div class="flex items-start gap-3">
									{#if item.typeMatches}
										<CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0" />
									{:else}
										<CircleAlert class="mt-0.5 h-4 w-4 shrink-0" />
									{/if}
									<div>
										<p class="text-sm font-semibold">{getTypeStatusLabel(item)}</p>
										<p class="mt-1 text-sm leading-6">
											Catálogo: {item.catalogLensType ? getLensTypeLabel(item.catalogLensType) : 'Sin tipo'}
											· Prescripción: {getLensTypeLabel(item.prescriptionLensType)}
										</p>
									</div>
								</div>
							</div>

							<div
								class="rounded-[0.9rem] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
							>
								<div class="flex items-start gap-3">
									<FlaskConical class="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
									<div>
										<p class="text-sm font-semibold">Chequeo de rango óptico</p>
										<p class="mt-1 text-sm leading-6 text-slate-700">
											{#if item.hasRanges}
												Se comparó la fórmula con los rangos cargados para este cristal.
											{:else}
												Este cristal no tiene rangos definidos. Confirma la fórmula y luego
												consulta con el laboratorio antes de cerrar el caso.
											{/if}
										</p>
									</div>
								</div>
							</div>
						</div>

						<div class="mt-4 space-y-2">
							{#each item.eyes as eye (eye.eye)}
								<div
									class={`rounded-[0.9rem] border px-4 py-3 ${getEyeStatusClasses(eye)}`}
								>
									<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
										<div>
											<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">
												{eye.eye}
											</p>
											<p class="mt-1 font-mono text-sm tabular-nums">{eye.prescriptionSummary}</p>
										</div>
										<span
											class="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase"
										>
											{getEyeStatusLabel(eye)}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
		<button
			type="button"
			onclick={handleClose}
			class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
		>
			Volver a editar
		</button>
		<button
			type="button"
			onclick={handleConfirm}
			class="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy/90"
		>
			Confirmar y continuar
		</button>
	</div>
</Modal>