<script lang="ts">
	import { ArrowRightCircle, CircleX, FileText } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quote: QuoteWithRelations;
		isCancelled: boolean;
		isConverted: boolean;
	}

	let { quote, isCancelled, isConverted }: Props = $props();
</script>

{#if quote.notes || isCancelled}
	<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
		{#if quote.notes}
			<section class="rounded-[1.5rem] bg-surface-container-low p-6">
				<div class="flex items-start gap-3">
					<div
						class="flex h-11 w-11 items-center justify-center rounded-xl bg-info-container text-on-info-container"
					>
						<FileText class="h-5 w-5" />
					</div>
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
							Observaciones
						</p>
						<p class="mt-2 text-base leading-relaxed whitespace-pre-wrap text-on-surface">
							{quote.notes}
						</p>
					</div>
				</div>
			</section>
		{/if}

		{#if isCancelled}
			<section class="rounded-[1.5rem] bg-error-container/70 p-6 text-on-error-container">
				<div class="flex items-start gap-3">
					<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/30">
						<CircleX class="h-5 w-5" />
					</div>
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-70">Estado</p>
						<h2 class="mt-2 text-2xl font-semibold text-current">Presupuesto cancelado</h2>
						<p class="mt-1 text-sm leading-relaxed text-current/80">
							Este presupuesto ya no puede convertirse en venta ni recibir nuevas acciones.
						</p>
					</div>
				</div>
			</section>
		{/if}
	</div>
{/if}

{#if isConverted && quote.conversionSaleId}
	<div
		class="flex items-center gap-3 rounded-[1.5rem] bg-info-container/55 p-4 text-on-info-container"
	>
		<ArrowRightCircle class="h-5 w-5 text-blue-500" />
		<p class="text-base text-slate-700">
			Este presupuesto fue convertido a venta.
			<a
				href={resolve(`/sales/${quote.conversionSaleId}`)}
				class="font-semibold text-blue-600 hover:underline"
			>
				Ver venta
			</a>
		</p>
	</div>
{/if}
