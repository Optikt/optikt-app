<script lang="ts">
	import { Percent } from '@lucide/svelte';
	import {
		ALL_PURCHASE_DISCOUNT_TYPES,
		PurchaseDiscountType,
		getPurchaseDiscountTypeLabel
	} from '$lib/shared/enums';

	interface Props {
		discountType: PurchaseDiscountType;
		discountValue: number;
		discountNotes: string;
	}

	let {
		discountType = $bindable(),
		discountValue = $bindable(),
		discountNotes = $bindable()
	}: Props = $props();

	const fieldLabelClass =
		'text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase';
	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

	function handleTypeChange(next: PurchaseDiscountType) {
		discountType = next;
		if (next === PurchaseDiscountType.NONE) {
			discountValue = 0;
			discountNotes = '';
		}
	}

	function clearDiscount() {
		handleTypeChange(PurchaseDiscountType.NONE);
	}

	const isActive = $derived(discountType !== PurchaseDiscountType.NONE);
	const valueSuffix = $derived(discountType === PurchaseDiscountType.PERCENT ? '%' : '$');
</script>

<section class="rounded-[1.75rem] bg-surface-container-lowest p-5 shadow-sm sm:p-6">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-start gap-3">
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold-dark"
			>
				<Percent class="h-5 w-5" />
			</div>
			<div>
				<p class="text-xs font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Descuento de liquidación
				</p>
				<h2 class="mt-1 text-lg font-semibold text-brand-navy">Descuento aplicado en la factura</h2>
				<p class="mt-1 text-xs text-on-surface-variant">
					Algunos proveedores otorgan un descuento al pagar. No afecta los precios de la nota de
					entrega, sólo el costo final imputado al inventario.
				</p>
			</div>
		</div>
		{#if isActive}
			<button
				type="button"
				onclick={clearDiscount}
				class="rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant ring-1 ring-outline-variant/40 transition-colors hover:bg-surface-container-high"
			>
				Limpiar
			</button>
		{/if}
	</div>

	<div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
		<div class="space-y-2">
			<span class={fieldLabelClass}>Tipo</span>
			<div class="grid grid-cols-3 gap-1 rounded-lg bg-surface-container-high p-1">
				{#each ALL_PURCHASE_DISCOUNT_TYPES as type (type)}
					<button
						type="button"
						onclick={() => handleTypeChange(type)}
						class={[
							'rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
							discountType === type
								? 'bg-brand-navy text-white shadow-sm'
								: 'text-on-surface-variant hover:bg-surface-container-highest'
						]}
					>
						{getPurchaseDiscountTypeLabel(type)}
					</button>
				{/each}
			</div>
		</div>

		<div class="space-y-2">
			<label class={fieldLabelClass} for="discount-value">Valor</label>
			<div class="relative">
				<input
					id="discount-value"
					type="number"
					min="0"
					step="0.01"
					max={discountType === PurchaseDiscountType.PERCENT ? 100 : undefined}
					bind:value={discountValue}
					disabled={!isActive}
					class={[inputClass, 'pr-10']}
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-on-surface-variant"
				>
					{valueSuffix}
				</span>
			</div>
		</div>

		<div class="space-y-2">
			<label class={fieldLabelClass} for="discount-notes">Notas (opcional)</label>
			<input
				id="discount-notes"
				type="text"
				bind:value={discountNotes}
				disabled={!isActive}
				placeholder="Ej. Descuento por pronto pago"
				class={inputClass}
			/>
		</div>
	</div>
</section>
