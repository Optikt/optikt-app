<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { TaxToggle } from '$lib/components/ui';
	import { LensPriceType, getPriceTypeLabel } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import {
		fieldLabelClass,
		formCardClass,
		sectionTitleClass,
		selectionCardClass
	} from './lensFormClasses';
	import { calculateLensPricing } from './lensFormPricing';
	import type { LensCatalogFormData } from './lensFormTypes';

	interface Props {
		formData: LensCatalogFormData;
	}

	let { formData = $bindable() }: Props = $props();

	const pricing = $derived(
		calculateLensPricing({
			basePrice: formData.basePrice,
			mountingPrice: formData.mountingPrice,
			shippingPrice: formData.shippingPrice,
			salePrice: formData.salePrice,
			priceType: formData.priceType
		})
	);
</script>

<section class={formCardClass}>
	<div class="flex items-center gap-2">
		<span class="h-2 w-2 rounded-full bg-error"></span>
		<h3 class={sectionTitleClass}>Estructura de costos y venta</h3>
	</div>

	<div class="mt-6 space-y-4">
		<div>
			<p class={fieldLabelClass}>Como cobra el proveedor</p>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<button
					type="button"
					aria-pressed={formData.priceType === LensPriceType.UNIT}
					class="{selectionCardClass} {formData.priceType === LensPriceType.UNIT
						? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
						: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
					onclick={() => (formData.priceType = LensPriceType.UNIT)}
				>
					<div>
						<p
							class="text-sm font-semibold {formData.priceType === LensPriceType.UNIT
								? 'text-white'
								: 'text-on-surface'}"
						>
							{getPriceTypeLabel(LensPriceType.UNIT)}
						</p>
						<p
							class="mt-1 text-xs leading-5 {formData.priceType === LensPriceType.UNIT
								? 'text-white/75'
								: 'text-on-surface-variant'}"
						>
							El costo base corresponde a un solo lente.
						</p>
					</div>
				</button>
				<button
					type="button"
					aria-pressed={formData.priceType === LensPriceType.PAIR}
					class="{selectionCardClass} {formData.priceType === LensPriceType.PAIR
						? 'border-brand-blue/60 bg-brand-navy text-white shadow-sm shadow-brand-navy/10'
						: 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-brand-blue/30 hover:bg-surface'}"
					onclick={() => (formData.priceType = LensPriceType.PAIR)}
				>
					<div>
						<p
							class="text-sm font-semibold {formData.priceType === LensPriceType.PAIR
								? 'text-white'
								: 'text-on-surface'}"
						>
							{getPriceTypeLabel(LensPriceType.PAIR)}
						</p>
						<p
							class="mt-1 text-xs leading-5 {formData.priceType === LensPriceType.PAIR
								? 'text-white/75'
								: 'text-on-surface-variant'}"
						>
							El costo base ya incluye el par completo.
						</p>
					</div>
				</button>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<Label for="lc_price" class={fieldLabelClass}>Costo proveedor (base)</Label>
				<div class="relative mt-2">
					<span
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-outline"
						>$</span
					>
					<input
						id="lc_price"
						name="basePrice"
						bind:value={formData.basePrice}
						type="number"
						step="0.01"
						min="0"
						class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-7 font-mono text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
						required
					/>
				</div>
			</div>
			<div>
				<p class={fieldLabelClass}>Costo por par (calculado)</p>
				<div
					class="bg-secondary-container/20 mt-2 flex h-[42px] items-center rounded-xl px-4 font-mono text-sm font-bold text-brand-blue"
				>
					$ {pricing.pairPurchasePrice.toFixed(2)}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-3">
			<div>
				<Label for="lc_mounting_price" class={fieldLabelClass}>Montaje</Label>
				<input
					id="lc_mounting_price"
					name="mountingPrice"
					bind:value={formData.mountingPrice}
					type="number"
					step="0.01"
					min="0"
					class="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
				/>
			</div>
			<div>
				<Label for="lc_shipping" class={fieldLabelClass}>Envio</Label>
				<input
					id="lc_shipping"
					name="shippingPrice"
					bind:value={formData.shippingPrice}
					type="number"
					step="0.01"
					min="0"
					class="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm shadow-sm transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
				/>
			</div>
			<div>
				<Label for="lc_sale_price" class={fieldLabelClass}>Precio venta</Label>
				<input
					id="lc_sale_price"
					name="salePrice"
					bind:value={formData.salePrice}
					type="number"
					step="0.01"
					min="0"
					class="mt-2 block w-full rounded-lg border border-slate-300 bg-brand-navy px-3 py-2.5 font-mono text-sm font-bold text-white shadow-sm transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
				/>
			</div>
		</div>

		<div class="rounded-xl bg-surface-container-high/40 px-5 py-5">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class={fieldLabelClass}>Margen estimado</p>
					<p
						class="font-heading mt-2 text-3xl font-semibold tracking-[-0.02em] text-brand-navy tabular-nums"
					>
						{pricing.marginPercent != null ? `${pricing.marginPercent.toFixed(1)}%` : '-'}
					</p>
				</div>
				<div class="text-right">
					<p class={fieldLabelClass}>Utilidad bruta</p>
					<p class="mt-2 font-mono text-2xl font-semibold text-brand-blue tabular-nums">
						{pricing.grossProfit != null ? formatPrice(pricing.grossProfit) : '-'}
					</p>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-3 pt-1">
			<div class="flex items-center justify-between gap-4">
				<TaxToggle bind:checked={formData.isTaxable} label="Gravable (IVA)" />
				<p class="text-xs text-on-surface-variant">
					Total con impuesto: {formatPrice(pricing.totalWithTax)}
				</p>
			</div>
		</div>
	</div>
</section>
