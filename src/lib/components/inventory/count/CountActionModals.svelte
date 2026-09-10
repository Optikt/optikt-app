<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';

	interface Props {
		showApplyModal: boolean;
		showCancelModal: boolean;
		cancelReason: string;
		countedTotal: number;
		matchedCount: number;
		pendingTotal: number;
		positiveDiffCount: number;
		positiveUnits: number;
		negativeDiffCount: number;
		negativeUnits: number;
		pendingManualAdjustments: number;
		isApplying: boolean;
		isCancelling: boolean;
		canCloseSession: boolean;
		onApply: () => void;
		onCancel: () => void;
	}

	let {
		showApplyModal = $bindable(),
		showCancelModal = $bindable(),
		cancelReason = $bindable(),
		countedTotal,
		matchedCount,
		pendingTotal,
		positiveDiffCount,
		positiveUnits,
		negativeDiffCount,
		negativeUnits,
		pendingManualAdjustments,
		isApplying,
		isCancelling,
		canCloseSession,
		onApply,
		onCancel
	}: Props = $props();
</script>

{#if showApplyModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !isApplying) {
				showApplyModal = false;
			}
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="inventory-count-apply-title"
			class="w-full max-w-lg rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
		>
			<div class="flex items-start gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-container text-on-warning-container"
				>
					<TriangleAlert class="h-5 w-5" />
				</div>
				<div>
					<h2 id="inventory-count-apply-title" class="text-xl font-semibold text-brand-navy">
						Cerrar sesión de conteo
					</h2>
					<p class="mt-1 text-sm text-on-surface-variant">
						Vas a cerrar esta sesión de conteo. Se registrará el informe de diferencias pero NO se
						aplicará ningún ajuste automático de stock. Los ajustes deben hacerse manualmente
						desde cada producto o lente usando el botón "Ir a ajustar".
					</p>
				</div>
			</div>

			<div class="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
				<div class="rounded-2xl bg-surface-container px-4 py-3">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Contados
					</p>
					<p class="mt-1 font-semibold text-brand-navy">{countedTotal}</p>
				</div>
				<div class="rounded-2xl bg-surface-container px-4 py-3">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Sin diferencia
					</p>
					<p class="mt-1 font-semibold text-brand-navy">{matchedCount}</p>
				</div>
				<div class="rounded-2xl bg-surface-container px-4 py-3">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Pendientes
					</p>
					<p class="mt-1 font-semibold text-brand-navy">{pendingTotal}</p>
				</div>
				<div class="rounded-2xl bg-surface-container px-4 py-3">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Diferencias +
					</p>
					<p class="mt-1 font-semibold text-success">
						{positiveDiffCount} ítems / +{positiveUnits}
					</p>
				</div>
				<div class="rounded-2xl bg-surface-container px-4 py-3">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Diferencias -
					</p>
					<p class="mt-1 font-semibold text-error">
						{negativeDiffCount} ítems / -{negativeUnits}
					</p>
				</div>
			</div>

			<div
				class="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
			>
				{pendingManualAdjustments} ítems con diferencia pendientes de ajuste manual.
			</div>

			{#if pendingTotal > 0}
				<div
					class="mt-4 rounded-2xl border border-warning/15 bg-warning-container/40 px-4 py-3 text-sm text-on-surface-variant"
				>
					No puedes cerrar la sesión todavía. Faltan {pendingTotal} ítems por contar o confirmar.
				</div>
			{/if}

			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={() => (showApplyModal = false)}
					disabled={isApplying}
					class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={onApply}
					disabled={isApplying || !canCloseSession}
					class="rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
				>
					{isApplying ? 'Cerrando...' : 'Cerrar sesión de conteo'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCancelModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget && !isCancelling) {
				showCancelModal = false;
			}
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="inventory-count-cancel-title"
			class="w-full max-w-lg rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
		>
			<h2 id="inventory-count-cancel-title" class="text-xl font-semibold text-brand-navy">
				Cancelar sesión
			</h2>
			<p class="mt-2 text-sm text-on-surface-variant">
				La sesión quedará en solo lectura y no se generará ningún ajuste.
			</p>

			<label class="mt-5 block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
					>Motivo</span
				>
				<textarea
					bind:value={cancelReason}
					rows="4"
					class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface"
					placeholder="Indica por qué se cancela la sesión"></textarea>
			</label>

			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={() => (showCancelModal = false)}
					disabled={isCancelling}
					class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
				>
					Volver
				</button>
				<button
					type="button"
					onclick={onCancel}
					disabled={isCancelling}
					class="rounded-xl bg-error px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
				>
					{isCancelling ? 'Cancelando...' : 'Confirmar cancelación'}
				</button>
			</div>
		</div>
	</div>
{/if}
