<script lang="ts">
	import { X, CircleCheck, CircleAlert, AlertTriangle, Sparkles } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import EyeSummary from '$lib/components/ui/EyeSummary.svelte';
	import type { Step2PrescriptionConfirmation } from './saleItemHelpers';

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
		onConfirm,
		onCancel
	}: Props = $props();

	const hasRangeWarnings = $derived(
		confirmation.items.some((item) =>
			item.eyes.some((eye) => eye.status !== 'in-range')
		)
	);

	function getEyeColor(status: string): string {
		if (status === 'in-range') return 'text-emerald-600';
		if (status === 'out-of-range') return 'text-amber-600';
		return 'text-slate-500';
	}

	function getEyeLabel(status: string): string {
		if (status === 'in-range') return 'En rango';
		if (status === 'out-of-range') return 'Revisar rango';
		return 'Consultar laboratorio';
	}

	$effect(() => {
		if (!open) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onCancel();
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div
			class="fixed inset-0 bg-black/50"
			transition:fade={{ duration: 200 }}
			role="presentation"
			onclick={onCancel}
		></div>

		<div
			class="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl"
			transition:fly={{ duration: 200, y: 24 }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-200 px-6 py-3">
				<h3 class="text-base font-semibold text-brand-navy">Revisión óptica</h3>
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Body -->
			<div class="max-h-[55vh] overflow-y-auto px-6 py-3">
				{#if !confirmation.hasLensItems}
					<div
						class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
					>
						<CircleCheck class="h-4 w-4 shrink-0" />
						Sin validación óptica pendiente
					</div>
				{:else}
					<div class="space-y-2">
						{#each confirmation.items as item, index (item.itemId)}
							<div class="rounded-lg border border-slate-200 px-3 py-2">
								<p class="text-[11px] font-semibold tracking-wider text-outline uppercase">
									Cristal {index + 1}
									<span class="ml-1 text-brand-navy normal-case">{item.lensName}</span>
									<span class="ml-1 text-outline normal-case"
										>— {getLensTypeLabel(item.prescriptionLensType)}</span
									>
								</p>
								<div class="mt-1 space-y-0.5">
									{#each item.eyes as eye (eye.eye)}
										<div class="flex items-center justify-between gap-2">
											<EyeSummary
												eye={eye.eye}
												lensEntry={{
													enabled: true,
													prescription: {
														sphere: eye.sphere,
														cylinder: eye.cylinder,
														axis: eye.axis,
														addition: eye.addition
													},
													dp: null,
													np: null
												}}
											/>
											<span
												class="inline-flex shrink-0 items-center gap-0.5 text-xs {getEyeColor(eye.status)}"
											>
												{#if eye.status === 'in-range'}
													<CircleCheck class="h-3.5 w-3.5" />
												{:else if eye.status === 'out-of-range'}
													<CircleAlert class="h-3.5 w-3.5" />
												{:else}
													<AlertTriangle class="h-3.5 w-3.5" />
												{/if}
												{getEyeLabel(eye.status)}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if confirmation.freeItems.length > 0}
					<div class="mt-3 space-y-1">
						<p class="text-[11px] font-semibold tracking-wider text-outline uppercase">
							Ítems libres ({confirmation.freeItems.length})
						</p>
						{#each confirmation.freeItems as freeItem (freeItem.itemId)}
							<div
								class="flex items-center justify-between gap-2 rounded-lg bg-violet-50/50 px-3 py-1.5 text-xs"
							>
								<span class="truncate text-slate-700">
									<Sparkles class="mr-1 inline h-3 w-3 shrink-0 text-violet-500" />
									<span
										class="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
									>
										{freeItem.categoryLabel}
									</span>
									{freeItem.description}
								</span>
								<span class="shrink-0 font-semibold text-brand-navy"
									>{formatPrice(freeItem.unitPrice)}</span
								>
							</div>
						{/each}
					</div>
				{/if}

				{#if hasRangeWarnings}
					<div
						class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
						transition:fade={{ duration: 200 }}
					>
						<p class="font-semibold">Revisar disponibilidad</p>
						<p class="mt-0.5 leading-5">
							Algunos valores están fuera de rango o requieren confirmación del
							laboratorio. Contacta al proveedor antes de procesar el pedido.
						</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
				>
					Volver a editar
				</button>
				<button
					type="button"
					onclick={onConfirm}
					class="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy/90"
				>
					Continuar
				</button>
			</div>
		</div>
	</div>
{/if}
