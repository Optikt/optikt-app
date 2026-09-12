<script lang="ts">
	import { EconomicBreakdownCard } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';

	interface Props {
		subtotal: number;
		total: number;
		discountType: string;
		discount: number;
		taxBreakdown: { taxableBase: number; exemptTotal: number; taxAmount: number };
		taxLabel: string | null;
		isDraft: boolean;
		hasCustomer: boolean;
		isConverted: boolean;
	}

	let {
		subtotal,
		total,
		discountType,
		discount,
		taxBreakdown,
		taxLabel,
		isDraft,
		hasCustomer,
		isConverted
	}: Props = $props();
</script>

<section class="grid gap-4 xl:grid-cols-3">
	<EconomicBreakdownCard
		{subtotal}
		{total}
		{discountType}
		{discount}
		{taxBreakdown}
		{taxLabel}
		totalLabel="Total estimado"
	/>

	<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Monto a cobrar</p>
		<p class="mt-4 font-mono text-3xl font-bold tracking-tight text-brand-navy md:text-4xl">
			{formatPrice(total)}
		</p>
		<p class="mt-3 text-base text-on-surface-variant">
			Desglose estimado del importe que se cobraría al convertir este presupuesto en venta.
		</p>
	</div>

	<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Siguiente acción</p>
		<p class="mt-4 text-2xl font-semibold tracking-tight text-brand-navy">
			{#if isDraft && hasCustomer}
				Listo para convertir
			{:else if isDraft}
				Asignar cliente
			{:else if isConverted}
				Ir a la venta creada
			{:else}
				Sin acciones disponibles
			{/if}
		</p>
		<p class="mt-3 text-base text-on-surface-variant">
			{#if isDraft && hasCustomer}
				Este presupuesto ya tiene cliente asociado y puede convertirse directamente a venta.
			{:else if isDraft}
				Necesitas asignar un cliente antes de convertir el presupuesto a venta.
			{:else if isConverted}
				El documento ya fue convertido y ahora el seguimiento continúa en la venta resultante.
			{:else}
				El documento quedó fuera del flujo activo y se conserva solo como referencia.
			{/if}
		</p>
	</div>
</section>
