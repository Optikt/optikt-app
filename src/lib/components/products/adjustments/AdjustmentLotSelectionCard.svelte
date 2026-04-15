<script lang="ts">
	import { AppBadge } from '$lib/components/ui';
	import type { InventoryLot } from '$lib/server/db/schema';
	import { formatDate, formatPrice } from '$lib/utils';

	interface Props {
		activeLots: InventoryLot[];
		selectedLotId: string;
	}

	let { activeLots, selectedLotId = $bindable('') }: Props = $props();
</script>

<section class="glass-card bg-surface-container-lowest p-8">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
				1. Seleccion de Lote
			</h2>
			<p class="mt-1 max-w-2xl text-sm text-on-surface-variant">
				El ajuste se registra sobre un lote real. El sistema conserva el costo historico y la
				trazabilidad de esa entrada.
			</p>
		</div>

		<AppBadge variant="info">Auditoria requerida</AppBadge>
	</div>

	<div class="mt-6 overflow-x-auto">
		<table class="min-w-full border-separate [border-spacing:0_0.65rem] text-left">
			<thead>
				<tr>
					<th class="px-3 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">
						Lote / batch
					</th>
					<th class="px-3 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">
						Ingreso
					</th>
					<th class="px-3 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">
						Costo u.
					</th>
					<th
						class="px-3 pb-2 text-right text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase"
					>
						Existencia
					</th>
					<th
						class="px-3 pb-2 text-center text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase"
					>
						Accion
					</th>
				</tr>
			</thead>
			<tbody>
				{#each activeLots as lot, index (lot.id)}
					{@const selected = selectedLotId === lot.id}
					<tr class="transition-transform duration-150 ease-out hover:-translate-y-px">
						<td
							class={`rounded-l-xl px-4 py-4 ${selected ? 'bg-surface-container text-brand-navy' : 'bg-surface-container-low text-brand-navy'}`}
						>
							<div class="flex items-center gap-2">
								<p class="font-mono text-xs font-semibold tracking-[0.14em] uppercase">
									LOT-{String(lot.lotNumber).padStart(4, '0')}
								</p>
								{#if index === 0}
									<AppBadge variant="info">FIFO</AppBadge>
								{/if}
								{#if selected}
									<AppBadge variant="success">Activo</AppBadge>
								{/if}
							</div>
							<p class="mt-1 text-xs text-on-surface-variant">
								Entrada original: <span class="font-mono">{lot.quantityInitial}</span> uds
							</p>
						</td>
						<td
							class={`px-4 py-4 text-sm ${selected ? 'bg-surface-container text-brand-navy' : 'bg-surface-container-low text-on-surface-variant'}`}
						>
							{formatDate(lot.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}
						</td>
						<td
							class={`px-4 py-4 font-mono text-sm ${selected ? 'bg-surface-container text-brand-navy' : 'bg-surface-container-low text-on-surface-variant'}`}
						>
							{formatPrice(lot.unitPurchasePrice)}
						</td>
						<td
							class={`px-4 py-4 text-right font-mono text-sm font-semibold ${selected ? 'bg-surface-container text-brand-navy' : 'bg-surface-container-low text-brand-navy'}`}
						>
							{lot.quantityAvailable}
						</td>
						<td
							class={`rounded-r-xl px-4 py-4 text-center ${selected ? 'bg-surface-container' : 'bg-surface-container-low'}`}
						>
							<input
								bind:group={selectedLotId}
								name="selectedLot"
								type="radio"
								value={lot.id}
								class="h-4 w-4 border-outline-variant bg-white text-brand-blue focus:ring-brand-blue"
								aria-label={`Seleccionar lote ${lot.lotNumber}`}
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="mt-5 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
		<p class="font-medium">Los lotes se muestran por antiguedad para respetar el flujo FIFO.</p>
		<p class="font-mono tracking-[0.12em] uppercase">{activeLots.length} lotes activos</p>
	</div>
</section>
