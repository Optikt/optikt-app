<script lang="ts">
	import { History } from '@lucide/svelte';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { formatDate, formatPrice } from '$lib/utils';
	import { getLensMarginPercent, getLensTotalCost } from './helpers';

	interface Props {
		item: LensCatalogItemWithRelations;
		onOpenHistory: () => void;
	}

	let { item, onOpenHistory }: Props = $props();

	const totalCost = $derived(
		getLensTotalCost(item.pairPurchasePrice, item.mountingPrice, item.shippingPrice)
	);
	const marginPercent = $derived(getLensMarginPercent(totalCost, item.salePrice));
</script>

<div class="space-y-6">
	<section
		class="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-6 py-6 text-white shadow-[0_18px_44px_rgba(21,35,70,0.18)] sm:px-7"
	>
		<div
			class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"
		></div>
		<div class="relative">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold tracking-[0.16em] text-brand-gold uppercase">
						Resumen comercial
					</p>
					<h2 class="font-heading mt-2 text-2xl font-bold text-white">Costo y venta</h2>
				</div>

				{#if marginPercent != null}
					<span
						class="rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase"
					>
						Margen {marginPercent.toFixed(0)}%
					</span>
				{/if}
			</div>

			<div class="mt-6 space-y-3 text-sm text-white/78">
				<div class="rounded-lg bg-white/5 p-3">
					<p class="mb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-gold uppercase">
						Costo de cristales
					</p>
					<div class="flex items-center justify-between gap-4">
						<span
							>{item.priceType === 'UNIT' ? 'Precio por unidad' : 'Precio informado por par'}</span
						>
						<span class="font-mono font-semibold text-white">{formatPrice(item.basePrice)}</span>
					</div>
					<div class="flex items-center justify-between gap-4">
						<span
							>{item.priceType === 'UNIT'
								? 'Costo de cristales (2 unidades)'
								: 'Costo de cristales por par'}</span
						>
						<span class="font-mono font-semibold text-white">
							{formatPrice(item.pairPurchasePrice)}
						</span>
					</div>
					<p class="mt-1 text-[10px] text-white/50">
						{item.priceType === 'UNIT'
							? `${formatPrice(item.basePrice)} x 2`
							: 'El proveedor cotiza directamente el par'}
					</p>
				</div>

				{#if item.mountingPrice > 0 || item.shippingPrice > 0}
					<div class="rounded-lg bg-white/5 p-3">
						<p class="mb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-gold uppercase">
							Costos adicionales
						</p>
						{#if item.mountingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Montaje (por par)</span>
								<span class="font-mono font-semibold text-white">
									{formatPrice(item.mountingPrice)}
								</span>
							</div>
						{/if}
						{#if item.shippingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Envío (por par)</span>
								<span class="font-mono font-semibold text-white">
									{formatPrice(item.shippingPrice)}
								</span>
							</div>
						{/if}
					</div>
				{/if}

				<div class="mt-1 border-t border-white/15 pt-3">
					<div class="flex items-center justify-between gap-4">
						<span class="font-semibold text-white">Costo total por par</span>
						<span class="font-mono font-bold text-brand-gold">{formatPrice(totalCost)}</span>
					</div>
				</div>
			</div>

			<div class="mt-6 rounded-[1.25rem] bg-white/10 px-4 py-4 backdrop-blur-sm">
				<p class="text-xs font-semibold tracking-[0.14em] text-white/72 uppercase">
					Precio de venta
				</p>
				{#if item.salePrice}
					<p class="mt-3 font-mono text-4xl font-bold tracking-tight text-white">
						{formatPrice(item.salePrice)}
					</p>
				{:else}
					<p class="mt-3 text-sm font-medium text-white/72">Sin precio cargado</p>
				{/if}
			</div>
		</div>
	</section>

	<section class="rounded-[1.75rem] bg-surface-container-low px-6 py-6 shadow-sm sm:px-7">
		<div class="flex items-start gap-3">
			<div
				class="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-lowest text-brand-navy shadow-sm"
			>
				<History class="h-4 w-4" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-semibold tracking-[0.16em] text-outline uppercase">Historial</p>
				<h2 class="font-heading mt-2 text-2xl font-bold text-brand-navy">
					Trazabilidad del registro
				</h2>
			</div>
		</div>

		<div class="mt-5 space-y-3">
			<div class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-sm">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Creado</p>
				<p class="mt-2 text-sm font-medium text-brand-navy">
					{formatDate(item.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>

			<div class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-sm">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Última actualización
				</p>
				<p class="mt-2 text-sm font-medium text-brand-navy">
					{formatDate(item.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>

			<div class="rounded-[1.25rem] bg-surface-container-lowest px-4 py-4 shadow-sm">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Registro</p>
				<p class="mt-2 font-mono text-xs leading-6 break-all text-on-surface-variant">{item.id}</p>
			</div>

			<button
				type="button"
				onclick={onOpenHistory}
				class="inline-flex w-full items-center justify-center rounded-lg bg-brand-navy px-4 py-3 text-xs font-semibold tracking-[0.16em] text-white uppercase transition-colors hover:bg-brand-navy-dark"
			>
				Abrir historial completo
			</button>
		</div>
	</section>
</div>
