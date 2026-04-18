<script lang="ts">
	import { AlertTriangle, Coins, ShieldCheck } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';

	interface Props {
		enabled: boolean;
		showLoss: boolean;
		estimatedLoss: number;
		unitCost: number | null;
		projectedQuantity: number | null;
		currentMonth: string;
		reportCategory: string | null;
	}

	let {
		enabled,
		showLoss,
		estimatedLoss,
		unitCost,
		projectedQuantity,
		currentMonth,
		reportCategory
	}: Props = $props();
</script>

<section
	class={`rounded-xl p-8 transition-opacity ${showLoss ? 'bg-error-container/30' : 'glass-card bg-surface-container-lowest'} ${enabled ? 'opacity-100' : 'opacity-60'}`}
>
	<div class="flex items-start gap-5">
		<div
			class={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${showLoss ? 'bg-error-container text-on-error-container' : enabled ? 'bg-info-container text-on-info-container' : 'bg-surface-container text-outline'}`}
		>
			{#if showLoss}
				<AlertTriangle class="h-5 w-5" />
			{:else if enabled}
				<ShieldCheck class="h-5 w-5" />
			{:else}
				<Coins class="h-5 w-5" />
			{/if}
		</div>

		<div class="flex-1 space-y-4">
			<div class="flex flex-wrap items-center gap-3">
				<h3
					class={`font-heading text-xl font-bold tracking-[-0.02em] ${showLoss ? 'text-on-error-container' : 'text-brand-navy'}`}
				>
					3. Impacto del Ajuste
				</h3>
				<AppBadge variant={showLoss ? 'error' : enabled ? 'info' : 'neutral'}>
					{showLoss ? 'Con costo' : enabled ? 'Registro trazable' : 'Pendiente'}
				</AppBadge>
			</div>

			<p
				class={`max-w-3xl text-sm ${showLoss ? 'text-on-error-container' : 'text-on-surface-variant'}`}
			>
				{#if showLoss}
					Esta salida registrara una perdida directa en el reporte de {currentMonth} bajo la categoria
					"{reportCategory}".
				{:else if enabled}
					El movimiento quedara documentado como "{reportCategory}" y se reflejara en la
					trazabilidad del inventario.
				{:else}
					El impacto aparece en cuanto eliges lote, motivo y cantidad. Si el motivo implica perdida
					operativa, se mostrara aqui el costo real del ajuste.
				{/if}
			</p>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div
					class={`rounded-xl px-4 py-4 ${showLoss ? 'bg-white/70' : 'bg-surface-container-low'}`}
				>
					<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">
						{showLoss ? 'Valor unitario' : 'Categoria'}
					</p>
					<p
						class={`mt-2 text-lg font-semibold ${showLoss ? 'font-mono text-brand-navy' : 'text-brand-navy'}`}
					>
						{#if showLoss}
							{unitCost != null ? formatPrice(unitCost) : '-'}
						{:else}
							{enabled ? reportCategory : 'Sin datos suficientes'}
						{/if}
					</p>
				</div>

				<div
					class={`rounded-xl px-4 py-4 ${showLoss ? 'bg-white/70' : 'bg-surface-container-low'}`}
				>
					<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">
						{showLoss ? 'Perdida estimada' : 'Stock proyectado del lote'}
					</p>
					<p
						class={`mt-2 text-lg font-semibold ${showLoss ? 'font-mono text-error' : 'font-mono text-brand-navy'}`}
					>
						{#if showLoss}
							-{formatPrice(estimatedLoss)}
						{:else}
							{projectedQuantity != null ? `${projectedQuantity} uds` : '-'}
						{/if}
					</p>
				</div>
			</div>
		</div>
	</div>
</section>
