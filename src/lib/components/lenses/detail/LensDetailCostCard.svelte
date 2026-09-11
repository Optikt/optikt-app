<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

	interface Props {
		item: LensCatalogItemWithRelations;
		variant: 'mobile' | 'desktop';
		totalCost: number;
		marginPercent: number | null;
	}

	let { item, variant, totalCost, marginPercent }: Props = $props();
</script>

{#if variant === 'mobile'}
	<div
		class="relative overflow-hidden rounded-2xl bg-brand-navy p-4 text-white shadow-[var(--ds-shadow-lg)]"
	>
		<div
			class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"
		></div>
		<div class="relative">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-brand-gold uppercase">
						Desglose de costos
					</p>
					<h2 class="font-heading mt-1.5 text-xl font-bold text-white">Costos internos</h2>
				</div>
				{#if marginPercent != null}
					<span
						class="shrink-0 rounded-full bg-brand-gold px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase"
					>
						Margen {marginPercent.toFixed(0)}%
					</span>
				{/if}
			</div>

			<div class="mt-4 flex flex-col gap-3 text-sm text-white/78">
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
						<span class="font-mono font-semibold text-white"
							>{formatPrice(item.pairPurchasePrice)}</span
						>
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
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.mountingPrice)}</span
								>
							</div>
						{/if}
						{#if item.shippingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Envío (por par)</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.shippingPrice)}</span
								>
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
		</div>
	</div>
{:else}
	<div
		class="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-7 py-6 text-white shadow-[var(--ds-shadow-lg)]"
	>
		<div
			class="absolute -top-16 right-[-2rem] h-40 w-40 rounded-full bg-brand-gold/15 blur-3xl"
		></div>
		<div class="relative space-y-2">
			<div>
				<div class="flex items-center justify-between gap-3">
					<p class="text-xs font-bold text-brand-gold uppercase">Resumen comercial</p>
					{#if marginPercent != null}
						<span
							class="shrink-0 rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase"
						>
							Margen {marginPercent.toFixed(0)}%
						</span>
					{/if}
				</div>
				<h2 class="font-heading text-2xl font-bold text-white">Costo y venta</h2>
			</div>

			<div class="flex flex-col gap-2 text-sm text-white/78">
				<div>
					<p class="mb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-gold uppercase">
						Costo de cristales
					</p>
					<div class="flex items-center justify-between gap-4">
						<span>{item.priceType === 'UNIT' ? 'Costo por unidad' : 'Costo informado por par'}</span
						>
						<span class="font-mono font-semibold text-white">{formatPrice(item.basePrice)}</span>
					</div>
					<div class="flex items-center justify-between gap-4">
						<span>Costo por par</span>
						<span class="font-mono font-semibold text-white"
							>{formatPrice(item.pairPurchasePrice)}</span
						>
					</div>
				</div>

				{#if item.mountingPrice > 0 || item.shippingPrice > 0}
					<div>
						<p class="mb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-gold uppercase">
							Costos adicionales
						</p>
						{#if item.mountingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Montaje (por par)</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.mountingPrice)}</span
								>
							</div>
						{/if}
						{#if item.shippingPrice > 0}
							<div class="flex items-center justify-between gap-4">
								<span>Envío (por par)</span>
								<span class="font-mono font-semibold text-white"
									>{formatPrice(item.shippingPrice)}</span
								>
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

			{#if item.salePrice}
				<div class="mt-4 border-t border-white/15 pt-3 backdrop-blur-sm">
					<p class="text-xs font-bold tracking-[0.14em] text-white uppercase">Precio de venta</p>
					<p class="mt-3 font-mono text-4xl font-bold tracking-tight text-white">
						{formatPrice(item.salePrice)}
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
