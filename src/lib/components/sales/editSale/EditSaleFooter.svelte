<script lang="ts">
	import { untrack } from 'svelte';
	import { X, Plus } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import DiscountSegmented from '$lib/components/commercialDocument/DiscountSegmented.svelte';
	import { formatPrice } from '$lib/utils';

	interface Props {
		subtotal: number;
		orderDiscountAmount: number;
		total: number;
		discount: number;
		discountType: string;
		reason: string;
		reasonError?: string;
		submitError?: string;
		saving: boolean;
		hasChanges: boolean;
		hasItems: boolean;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		subtotal,
		orderDiscountAmount,
		total,
		discount = $bindable(),
		discountType = $bindable(),
		reason = $bindable(),
		reasonError = '',
		submitError = '',
		saving,
		hasChanges,
		hasItems,
		onClose,
		onSubmit
	}: Props = $props();

	const maxLength = 500;
	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// ── Reason (shown only while there are changes) ─────────────────────────
	let reasonSeen = $state(false);
	let reasonAnim = $state(false);

	$effect(() => {
		if (hasChanges && !reasonSeen) {
			reasonSeen = true;
			reasonAnim = true;
		}
	});

	// ── Order discount (collapsed until requested or already set) ───────────
	let discountOpen = $state(false);

	$effect(() => {
		if (discount > 0) discountOpen = true;
	});

	function openDiscount() {
		discountOpen = true;
	}

	function removeDiscount() {
		discount = 0;
		discountOpen = false;
	}

	// ── Missing-anything hint + save enablement ─────────────────────────────
	const reasonMissing = $derived(!reason.trim());
	const missingHint = $derived(
		!hasItems
			? 'Debe quedar al menos un artículo'
			: hasChanges && reasonMissing
				? 'Falta el motivo de la modificación'
				: ''
	);
	const canSave = $derived(hasChanges && hasItems && !reasonMissing && !saving);

	// ── Save / cancel tooltips ──────────────────────────────────────────────
	const saveTooltip = $derived(
		canSave
			? 'Guardar y registrar en la auditoría de ventas'
			: !hasChanges
				? 'No hay cambios para guardar'
				: missingHint
	);
	const cancelTooltip = $derived(hasChanges ? 'Descartar los cambios' : 'Cerrar sin cambios');

	// ── Animated total (380 ms ease-out count; only when the target changes) ─
	// svelte-ignore state_referenced_locally
	let displayedTotal = $state(total);

	$effect(() => {
		const target = total;
		if (reduceMotion) {
			displayedTotal = target;
			return;
		}
		const start = untrack(() => displayedTotal);
		if (start === target) return;
		const t0 = performance.now();
		let frame: number;
		const step = (now: number) => {
			const k = Math.min(1, (now - t0) / 380);
			const eased = 1 - Math.pow(1 - k, 3);
			displayedTotal = start + (target - start) * eased;
			if (k < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>

<footer
	class="shrink-0 bg-brand-navy px-5 pt-3 pb-4 text-white shadow-[0_-8px_24px_rgba(21,35,70,0.18)]"
>
	{#if hasChanges}
		<div class="relative mb-2.5" class:reason-in={reasonAnim && !reduceMotion}>
			{#snippet reasonTrigger({ props }: { props: Record<string, unknown> })}
				<span class="relative block w-full">
					<input
						{...props}
						type="text"
						bind:value={reason}
						maxlength={maxLength}
						placeholder="Motivo de la modificación (obligatorio, queda en auditoría)"
						aria-label="Motivo de la modificación"
						class="h-9 w-full rounded-lg border border-white/35 bg-transparent pr-14 pl-3 text-[13px] text-white outline-offset-[-1px] outline-transparent transition placeholder:text-white/50 focus:outline-2 focus:outline-brand-blue"
					/>
					<span
						class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-white/60 tabular-nums"
						aria-hidden="true"
					>
						{reason.length}/{maxLength}
					</span>
				</span>
			{/snippet}

			<TriggerTooltip
				text="Obligatorio · queda registrado en la auditoría de ventas"
				side="top"
				trigger={reasonTrigger}
			/>
		</div>
	{/if}

	<div
		class="grid grid-cols-1 items-end gap-x-6 gap-y-3 min-[560px]:grid-cols-[minmax(300px,380px)_1fr]"
	>
		<!-- Summary (right-aligned stack) -->
		<div class="space-y-0.5">
			<div class="flex items-center justify-between gap-4 py-0.5 text-[13px] text-[#c9d3ea]">
				<span>Subtotal</span>
				<span class="font-semibold text-white tabular-nums">{formatPrice(subtotal)}</span>
			</div>

			<div class="flex items-center justify-between gap-4 py-0.5 text-[13px] text-[#c9d3ea]">
				<span>Descuento de la orden</span>
				<span class="flex items-center gap-2">
					{#if !discountOpen}
						{#snippet addTrigger({ props }: { props: Record<string, unknown> })}
							<button
								{...props}
								type="button"
								onclick={openDiscount}
								class="inline-flex h-[26px] items-center gap-1 rounded-lg border border-white/40 bg-white/10 px-2.5 text-[12px] font-semibold text-white transition hover:bg-white/20"
							>
								<Plus class="h-3 w-3" /> Agregar
							</button>
						{/snippet}
						<TriggerTooltip
							text="Aplicar un descuento a toda la orden"
							side="top"
							trigger={addTrigger}
						/>
					{/if}
					{#if discountOpen}
						<span class="font-semibold text-[#ffb4ab] tabular-nums"
							>−{formatPrice(orderDiscountAmount)}</span
						>
					{/if}
				</span>
			</div>

			<div
				class={`grid opacity-0 transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(.25,1,.5,1)] ${discountOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr]'}`}
				aria-hidden={!discountOpen}
				inert={!discountOpen}
			>
				<div class="overflow-hidden">
					<div class="flex items-center gap-2 py-1 pb-2">
						<DiscountSegmented
							variant="navy"
							size="sm"
							type={discountType}
							value={discount}
							onType={(value) => (discountType = value)}
							onValue={(value) => (discount = value)}
							disabled={saving}
							focusOnMount={discountOpen}
						/>
						{#snippet removeTrigger({ props }: { props: Record<string, unknown> })}
							<button
								{...props}
								type="button"
								onclick={removeDiscount}
								aria-label="Quitar el descuento"
								class="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-[#c9d3ea] transition hover:bg-white/14 hover:text-white"
							>
								<X class="h-[15px] w-[15px]" />
							</button>
						{/snippet}
						<TriggerTooltip text="Quitar el descuento" side="top" trigger={removeTrigger} />
					</div>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex flex-col items-end gap-1.5">
			{#if missingHint}
				<p class="text-[12px] font-semibold text-brand-gold-light" role="status">{missingHint}</p>
			{/if}
			<div class="flex items-center gap-2.5">
				{#snippet cancelTrigger({ props }: { props: Record<string, unknown> })}
					<button
						{...props}
						type="button"
						onclick={onClose}
						disabled={saving}
						class="h-9 rounded-lg border border-white/40 bg-transparent px-4 text-[13px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
					>
						Cancelar
					</button>
				{/snippet}
				<TriggerTooltip text={cancelTooltip} side="top" trigger={cancelTrigger} />

				{#snippet saveTrigger({ props }: { props: Record<string, unknown> })}
					<button
						{...props}
						type="button"
						onclick={() => {
							if (canSave) onSubmit();
						}}
						aria-disabled={!canSave}
						class={`inline-flex h-9 min-w-[150px] items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-bold text-brand-navy transition ${
							canSave
								? 'bg-brand-gold hover:bg-brand-gold-dark'
								: 'cursor-not-allowed bg-white/14 text-white/50'
						}`}
					>
						{#if saving}
							<span
								class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
							></span>
							Guardando...
						{:else}
							Guardar cambios
						{/if}
					</button>
				{/snippet}
				<TriggerTooltip text={saveTooltip} side="top" trigger={saveTrigger} />
			</div>
			{#if reasonError || submitError}
				<p class="text-[11px] text-[#ffb4ab]" role="alert">{reasonError || submitError}</p>
			{/if}
		</div>
	</div>

	<!-- Total row -->
	<div class="mt-1 flex items-center justify-between border-t border-white/20 pt-2">
		<span class="font-heading text-[15px] font-bold text-white/90">Total</span>
		<span class="font-heading text-[26px] font-bold text-white tabular-nums">
			{formatPrice(displayedTotal)}
		</span>
	</div>
</footer>

<style>
	@keyframes reason-in {
		from {
			transform: translateY(10px);
			opacity: 0;
		}
	}
	.reason-in {
		animation: reason-in 0.3s cubic-bezier(0.25, 1, 0.5, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		.reason-in {
			animation: none;
		}
		.grid-rows-\[1fr\] {
			transition: none;
		}
	}
</style>
