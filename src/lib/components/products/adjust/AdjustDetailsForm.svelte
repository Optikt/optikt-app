<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import type { ManualAdjustmentType } from '$lib/components/products/adjustments/helpers';
	import { AppBadge, FormInput } from '$lib/components/ui';
	import { InventoryMovementType } from '$lib/shared/enums';
	import type { InventoryLot } from '$lib/server/db/schema';
	import type { ReasonOption } from './adjustmentView';

	interface Props {
		detailsEnabled: boolean;
		selectedReasonLabel: string | null;
		showsFinancialWarning: boolean;
		reason: string;
		reasonOptions: ReasonOption[];
		onReasonChange: (next: string) => void;
		directionEnabled: boolean;
		allowedAdjustmentTypes: ManualAdjustmentType[];
		adjustmentType: ManualAdjustmentType | null;
		directionHint: string;
		quantity: string;
		quantityError: string | null;
		isOutflow: boolean;
		selectedLot: InventoryLot | null;
		notes: string;
		notesRemaining: number;
	}

	let {
		detailsEnabled,
		selectedReasonLabel,
		showsFinancialWarning,
		reason,
		reasonOptions,
		onReasonChange,
		directionEnabled,
		allowedAdjustmentTypes,
		adjustmentType = $bindable(null),
		directionHint,
		quantity = $bindable(''),
		quantityError,
		isOutflow,
		selectedLot,
		notes = $bindable(''),
		notesRemaining
	}: Props = $props();
</script>

<section
	class={`glass-card bg-surface-container-lowest p-8 transition-opacity ${detailsEnabled ? 'opacity-100' : 'opacity-70'}`}
>
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
				2. Detalles del Ajuste
			</h2>
			<p class="mt-1 text-sm text-on-surface-variant">
				Define direccion, motivo y contexto del movimiento antes de registrarlo.
			</p>
		</div>

		{#if selectedReasonLabel}
			<AppBadge variant={showsFinancialWarning ? 'error' : 'info'}>
				{selectedReasonLabel}
			</AppBadge>
		{/if}
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="space-y-2">
			<label
				for="reason"
				class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
			>
				Motivo
			</label>
			<select
				id="reason"
				value={reason}
				onchange={(event) => onReasonChange((event.currentTarget as HTMLSelectElement).value)}
				disabled={!detailsEnabled}
				class="w-full rounded-xl border-0 bg-surface-container-low px-4 py-3 text-sm text-brand-navy focus:ring-2 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
			>
				<option value="">Selecciona motivo...</option>
				{#each reasonOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		<fieldset class="space-y-2">
			<legend class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">
				Direccion del ajuste
			</legend>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					disabled={!directionEnabled ||
						!allowedAdjustmentTypes.includes(InventoryMovementType.ADJUSTMENT_IN)}
					onclick={() => (adjustmentType = InventoryMovementType.ADJUSTMENT_IN)}
					class={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${adjustmentType === InventoryMovementType.ADJUSTMENT_IN ? 'bg-brand-navy text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'} disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-outline disabled:hover:bg-surface-container-low`}
				>
					<Plus class="h-4 w-4" />
					Incremento
				</button>
				<button
					type="button"
					disabled={!directionEnabled ||
						!allowedAdjustmentTypes.includes(InventoryMovementType.ADJUSTMENT_OUT)}
					onclick={() => (adjustmentType = InventoryMovementType.ADJUSTMENT_OUT)}
					class={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${adjustmentType === InventoryMovementType.ADJUSTMENT_OUT ? 'bg-brand-navy text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'} disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-outline disabled:hover:bg-surface-container-low`}
				>
					<Minus class="h-4 w-4" />
					Reduccion
				</button>
			</div>
			<p class="text-xs text-on-surface-variant">{directionHint}</p>
		</fieldset>

		<div class="space-y-2">
			<label
				for="adjustment-quantity"
				class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
			>
				Cantidad a ajustar
			</label>
			<FormInput
				id="adjustment-quantity"
				bind:value={quantity}
				type="number"
				min="1"
				max={isOutflow && selectedLot ? String(selectedLot.quantityAvailable) : undefined}
				placeholder="0"
				disabled={!detailsEnabled}
				error={quantityError}
				class="!rounded-xl !border-0 !bg-surface-container-low !px-4 !py-3 !text-sm !text-brand-navy !shadow-none"
			/>
		</div>

		<div class="space-y-2">
			<label
				for="adjustment-notes"
				class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
			>
				Notas internas
			</label>
			<textarea
				id="adjustment-notes"
				bind:value={notes}
				rows="3"
				placeholder="Escribe el contexto del ajuste con detalle..."
				disabled={!detailsEnabled}
				class="w-full rounded-xl border-0 bg-surface-container-low px-4 py-3 text-sm text-brand-navy placeholder:text-slate-400 focus:ring-2 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
			></textarea>
			{#if notes.length > 0 && notesRemaining > 0}
				<p class="text-sm text-error">{notesRemaining} caracteres mas requeridos</p>
			{/if}
		</div>
	</div>
</section>
