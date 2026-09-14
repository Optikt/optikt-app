<script lang="ts">
	import { Coins } from '@lucide/svelte';
	import { TaxToggle } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import type { Product } from '$lib/server/db/schema';
	import { noteCardClass, sectionClass, statCardClass } from './productFormClasses';
	import type { ProductFormData } from './productFormTypes';

	interface Props {
		formData: ProductFormData;
		product?: Product | null;
		pricingCopy: string | null;
		hasCommercialReferences: boolean;
		taxSummary: string;
	}

	let { formData, product, pricingCopy, hasCommercialReferences, taxSummary }: Props = $props();
</script>

<section class={sectionClass}>
	<div class="mb-5 flex items-center gap-3">
		<div
			class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/18 text-brand-navy"
		>
			<Coins size={18} />
		</div>
		<div>
			<h2 class="font-heading text-xl font-semibold text-brand-navy">Precios e impuestos</h2>
		</div>
	</div>

	<div class="space-y-4">
		{#if pricingCopy != null}
			<div class={noteCardClass}>
				<p class="text-[10px] font-bold tracking-[0.18em] text-brand-blue uppercase">
					Estado de precios
				</p>
				<p class="mt-2 text-sm text-on-surface-variant">{pricingCopy}</p>
			</div>
		{/if}

		{#if hasCommercialReferences}
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
				{#if product?.currentPurchasePrice != null}
					<div class={statCardClass}>
						<p class="text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
							Costo referencial actual
						</p>
						<p class="mt-2 font-mono text-lg font-semibold text-brand-navy">
							{formatPrice(product.currentPurchasePrice)}
						</p>
						<p class="mt-1 text-xs text-on-surface-variant">
							Viene de la ultima compra confirmada del producto.
						</p>
					</div>
				{/if}

				{#if product?.currentSalePrice != null}
					<div class={statCardClass}>
						<p class="text-[10px] font-bold tracking-[0.18em] text-outline uppercase">
							Precio de venta actual
						</p>
						<p class="mt-2 font-mono text-lg font-semibold text-brand-navy">
							{formatPrice(product.currentSalePrice)}
						</p>
						<p class="mt-1 text-xs text-on-surface-variant">
							Se consulta aqui, pero se ajusta fuera de este formulario.
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<div class={noteCardClass}>
			<p class="text-[10px] font-bold tracking-[0.18em] text-outline uppercase">Impuestos</p>
			<p class="mt-2 text-sm font-semibold text-brand-navy">{taxSummary}</p>
			<div class="mt-2">
				<TaxToggle
					bind:checked={formData.isTaxable}
					label="Aplica IVA"
					ariaLabel="Alternar IVA del producto"
				/>
			</div>
		</div>
	</div>
</section>
