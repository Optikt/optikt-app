<script lang="ts">
	import { Pen } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import DiscountSegmented from '$lib/components/commercialDocument/DiscountSegmented.svelte';
	import { formatPrice } from '$lib/utils';

	interface Props {
		subtotal: number;
		itemsDiscount: number;
		orderDiscountAmount: number;
		total: number;
		discount: number;
		discountType: string;
		reason: string;
		reasonError: string;
		submitError?: string;
		removedCount: number;
		saving: boolean;
		hasChanges: boolean;
		onClose: () => void;
		onSubmit: () => void;
		onClearReasonError: () => void;
	}

	let {
		subtotal,
		itemsDiscount,
		orderDiscountAmount,
		total,
		discount = $bindable(),
		discountType = $bindable(),
		reason = $bindable(),
		reasonError,
		submitError = '',
		removedCount,
		saving,
		hasChanges,
		onClose,
		onSubmit,
		onClearReasonError
	}: Props = $props();

	const reasonMissing = $derived(!reason.trim());
	const canSubmit = $derived(hasChanges && !reasonMissing && !saving);
	const maxLength = 500;
</script>

<footer
	class="shrink-0 border-t border-outline-variant/60 bg-white px-5 py-2 dark:border-slate-700 dark:bg-slate-900"
>
	<div class="mb-2 space-y-0.5">
		<div class="flex items-center justify-between text-[12px] text-slate-600 dark:text-slate-400">
			<span>Subtotal</span>
			<span class="font-semibold text-brand-navy tabular-nums dark:text-white">
				{formatPrice(subtotal)}
			</span>
		</div>

		{#if itemsDiscount > 0}
			<div class="flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400">
				<span>Descuento en artículos</span>
				<span class="font-semibold text-rose-600 tabular-nums dark:text-rose-400">
					−{formatPrice(itemsDiscount)}
				</span>
			</div>
		{/if}

		<div
			class="flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-600 dark:text-slate-400"
		>
			<span>Descuento de la orden</span>
			<div class="ml-auto flex items-center gap-2">
				<DiscountSegmented
					type={discountType}
					value={discount}
					onType={(value) => (discountType = value)}
					onValue={(value) => (discount = value)}
					disabled={saving}
				/>
				<span
					class="min-w-[66px] text-right font-semibold text-rose-600 tabular-nums dark:text-rose-400"
				>
					−{formatPrice(orderDiscountAmount)}
				</span>
			</div>
		</div>

		<div
			class="mt-0.5 flex items-center justify-between border-t border-outline-variant/60 pt-1 dark:border-slate-700"
		>
			<span class="text-sm font-extrabold text-brand-navy dark:text-white">Total</span>
			<span
				class="text-[19px] font-extrabold text-brand-blue-dark tabular-nums dark:text-brand-blue-light"
			>
				{formatPrice(total)}
			</span>
		</div>

		{#if removedCount > 0}
			<p class="text-[11px] text-rose-600 dark:text-rose-400">
				{removedCount} artículo(s) se eliminarán al guardar
			</p>
		{/if}
	</div>

	<div class="mb-2">
		<textarea
			bind:value={reason}
			oninput={onClearReasonError}
			maxlength={maxLength}
			rows="1"
			placeholder="Motivo de la modificación (obligatorio)…"
			class="max-h-24 min-h-9 w-full resize-none rounded-[10px] border bg-white px-3 py-2.5 text-[13px] text-brand-navy transition outline-none placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:bg-slate-800 dark:text-white {reasonMissing &&
			hasChanges
				? 'border-amber-300 dark:border-amber-700'
				: 'border-outline-variant/70 dark:border-slate-600'}"></textarea>
		<div
			class="flex items-center justify-between gap-2 text-[10.5px] text-slate-400 dark:text-slate-500"
		>
			<span>Obligatorio · queda registrado en la auditoría de ventas</span>
			<span class="tabular-nums">{reason.length}/{maxLength}</span>
		</div>
		{#if reasonError}
			<p class="mt-1 text-[11px] text-red-600 dark:text-red-400">{reasonError}</p>
		{/if}
		{#if submitError}
			<p class="mt-1 text-[11px] text-red-600 dark:text-red-400" role="alert">{submitError}</p>
		{/if}
	</div>

	<div class="flex items-center justify-end gap-2">
		<button
			type="button"
			onclick={onClose}
			disabled={saving}
			class="h-8 rounded-lg border border-outline-variant bg-white px-3.5 text-[13.5px] font-semibold text-slate-600 transition hover:bg-surface-container disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
		>
			Cancelar
		</button>

		{#snippet saveTrigger({ props }: { props: Record<string, unknown> })}
			<button
				{...props}
				type="button"
				onclick={() => {
					if (!canSubmit) return;
					onSubmit();
				}}
				aria-disabled={!canSubmit}
				class="inline-flex h-8 min-w-[150px] items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 text-[13.5px] font-semibold text-white transition hover:bg-brand-navy-dark aria-disabled:cursor-not-allowed aria-disabled:bg-surface-container-high aria-disabled:text-slate-400 dark:aria-disabled:bg-slate-700 dark:aria-disabled:text-slate-500"
			>
				{#if saving}
					<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></span>
					Guardando...
				{:else}
					<Pen class="h-4 w-4" /> Guardar cambios
				{/if}
			</button>
		{/snippet}

		{#if !hasChanges}
			<TriggerTooltip text="No hay cambios para guardar" trigger={saveTrigger} />
		{:else if reasonMissing}
			<TriggerTooltip
				title="Falta completar:"
				items={['Motivo de la modificación']}
				trigger={saveTrigger}
			/>
		{:else}
			{@render saveTrigger({ props: {} })}
		{/if}
	</div>
</footer>
