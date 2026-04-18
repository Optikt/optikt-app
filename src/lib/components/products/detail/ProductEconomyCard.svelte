<script lang="ts">
	import { BadgeDollarSign, Check, Pencil, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { updateSalePriceCmd } from '$lib/remote/products.remote';
	import { formatPrice, getErrorMessage, getProfitMargin } from '$lib/utils';

	interface Props {
		productId: string;
		salePrice: number | null;
		fifoCost: number | null;
		inventoryValuation: number;
	}

	let { productId, salePrice, fifoCost, inventoryValuation }: Props = $props();

	let currentSalePrice = $state<number | null>(untrack(() => salePrice));
	let editingPrice = $state(false);
	let priceInput = $state('');
	let priceSaving = $state(false);

	const marginPercent = $derived(
		fifoCost != null && currentSalePrice != null && fifoCost > 0
			? ((currentSalePrice - fifoCost) / fifoCost) * 100
			: null
	);

	const marginLabel = $derived.by(() => {
		if (marginPercent == null) return 'Sin referencia';
		if (marginPercent >= 60) return 'Alto rendimiento';
		if (marginPercent >= 40) return 'Margen saludable';
		if (marginPercent > 0) return 'Margen ajustado';
		return 'Revisar precio';
	});

	function startEditingPrice() {
		priceInput = currentSalePrice != null ? String(currentSalePrice) : '';
		editingPrice = true;
	}

	function cancelEditingPrice() {
		editingPrice = false;
	}

	async function savePrice() {
		const value = parseFloat(priceInput);
		if (Number.isNaN(value) || value < 0) {
			toast.error('Precio invalido');
			return;
		}

		priceSaving = true;
		try {
			const result = await updateSalePriceCmd({ id: productId, currentSalePrice: value });
			if (!result.success) {
				toast.error(result.error ?? 'Error actualizando precio');
				return;
			}

			currentSalePrice = value;
			editingPrice = false;
			toast.success('Precio de venta actualizado');
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error actualizando precio'));
		} finally {
			priceSaving = false;
		}
	}
</script>

<section
	class="relative overflow-hidden rounded-xl bg-[linear-gradient(160deg,var(--color-brand-navy-dark),var(--color-brand-navy))] p-8 text-on-primary shadow-[var(--ds-shadow-lg)]"
>
	<div class="absolute top-0 right-0 h-40 w-40 rounded-full bg-brand-blue/15 blur-3xl"></div>

	<div class="relative z-10 flex h-full flex-col justify-between gap-8">
		<div class="space-y-8">
			<div class="flex items-center justify-between gap-4">
				<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-white">Economia</h2>
				<BadgeDollarSign class="h-5 w-5 text-white/60" />
			</div>

			<div class="space-y-4">
				<p class="text-[0.65rem] font-bold tracking-[0.18em] text-white/60 uppercase">
					Precio de venta
				</p>

				{#if editingPrice}
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={priceInput}
							step="0.01"
							min="0"
							class="w-full rounded-lg border-none bg-white/12 px-4 py-3 font-mono text-3xl font-bold tracking-[-0.03em] text-white placeholder:text-white/40 focus:bg-white/18 focus:ring-0"
							onkeydown={(event) => {
								if (event.key === 'Enter') savePrice();
								if (event.key === 'Escape') cancelEditingPrice();
							}}
							disabled={priceSaving}
						/>
						<button
							type="button"
							onclick={savePrice}
							disabled={priceSaving}
							class="flex h-11 w-11 items-center justify-center rounded-lg bg-success-container text-on-success-container transition-colors hover:brightness-105 disabled:opacity-60"
							aria-label="Guardar precio"
						>
							<Check class="h-4 w-4" />
						</button>
						<button
							type="button"
							onclick={cancelEditingPrice}
							disabled={priceSaving}
							class="flex h-11 w-11 items-center justify-center rounded-lg bg-error-container text-on-error-container transition-colors hover:brightness-105 disabled:opacity-60"
							aria-label="Cancelar edicion"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
				{:else}
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="font-heading text-5xl font-extrabold tracking-[-0.04em] text-white">
								{currentSalePrice != null ? formatPrice(currentSalePrice) : '-'}
							</p>
							{#if currentSalePrice == null}
								<p class="mt-2 text-sm text-white/70">Sin precio definido</p>
							{/if}
						</div>

						<button
							type="button"
							onclick={startEditingPrice}
							class="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/16"
							aria-label="Editar precio de venta"
						>
							<Pencil class="h-4 w-4" />
						</button>
					</div>
				{/if}
			</div>

			<div class="space-y-4">
				<div class="h-px bg-white/10"></div>
				<div class="flex items-center justify-between gap-4">
					<p class="text-[0.65rem] font-bold tracking-[0.18em] text-white/60 uppercase">
						Costo FIFO siguiente unidad
					</p>
					<p class="font-mono text-lg font-semibold text-white">
						{fifoCost != null ? formatPrice(fifoCost) : '-'}
					</p>
				</div>
				<div class="flex items-center justify-between gap-4">
					<p class="text-[0.65rem] font-bold tracking-[0.18em] text-white/60 uppercase">
						Margen bruto
					</p>
					<div class="text-right">
						<p class="text-3xl font-bold text-brand-gold">
							{marginPercent != null ? getProfitMargin(fifoCost ?? 0, currentSalePrice ?? 0) : '-'}
						</p>
						<p class="text-[0.6rem] font-bold tracking-[0.16em] text-brand-gold/80 uppercase">
							{marginLabel}
						</p>
					</div>
				</div>
			</div>
		</div>

		<div class="relative z-10 rounded-xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-white/60 uppercase">
				Valorizacion de inventario
			</p>
			<p class="font-heading mt-2 text-3xl font-bold tracking-[-0.03em] text-white">
				{formatPrice(inventoryValuation)}
			</p>
		</div>
	</div>
</section>
