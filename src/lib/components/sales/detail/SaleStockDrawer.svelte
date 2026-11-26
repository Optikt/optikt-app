<script lang="ts">
	import { ArrowDown, ArrowUp, X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import { getInventoryMovementTypeLabel } from '$lib/shared/enums';
	import {
		computeStockNet,
		filterStockEntries,
		groupStockMovements,
		isStockOut,
		type StockFilter
	} from './saleStock';

	interface Props {
		open: boolean;
		onclose: () => void;
		movements: MovementWithDetails[];
	}

	let { open, onclose, movements }: Props = $props();

	let filter = $state<StockFilter>('all');

	const groups = $derived(groupStockMovements(movements));
	const net = $derived(computeStockNet(movements));
	const visibleGroups = $derived(
		groups
			.map((group) => ({ ...group, entries: filterStockEntries(group.entries, filter) }))
			.filter((group) => group.entries.length > 0)
	);

	const filters: Array<{ key: StockFilter; label: string }> = [
		{ key: 'all', label: 'Todos' },
		{ key: 'out', label: 'Salidas' },
		{ key: 'revert', label: 'Reversiones' }
	];
</script>

<SlideOver {open} {onclose} widthClass="w-full sm:w-[440px]" bodyClass="px-4 py-3">
	{#snippet header({ onclose: close })}
		<div class="flex items-center gap-3 border-b border-outline-variant/15 px-4 py-3.5">
			<div class="min-w-0 flex-1">
				<h2 class="font-heading text-lg font-semibold text-brand-navy">Stock de la venta</h2>
				<p class="mt-0.5 text-xs text-outline" style="overflow-wrap:anywhere">
					{movements.length} movimientos · efecto neto por producto
				</p>
			</div>
			<AppBadge variant="neutral">{movements.length}</AppBadge>
			<button
				type="button"
				onclick={close}
				class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	{#if movements.length === 0}
		<p class="px-2 py-7 text-center text-[13px] text-outline italic">
			No hay movimientos de stock registrados
		</p>
	{:else}
		<!-- Resumen neto por producto -->
		<section
			aria-label="Efecto neto por producto"
			class="mb-3 overflow-hidden rounded-xl border border-outline-variant/60 bg-white"
		>
			<table class="w-full text-[13px]">
				<thead>
					<tr class="text-left text-[11px] font-semibold tracking-[0.12em] text-outline uppercase">
						<th scope="col" class="px-3 pt-2.5 pb-1.5 font-semibold">Producto</th>
						<th scope="col" class="px-2 pt-2.5 pb-1.5 text-right font-semibold tabular-nums">
							Salidas
						</th>
						<th scope="col" class="px-2 pt-2.5 pb-1.5 text-right font-semibold tabular-nums">
							Reversiones
						</th>
						<th scope="col" class="px-3 pt-2.5 pb-1.5 text-right font-semibold tabular-nums">
							Neto
						</th>
					</tr>
				</thead>
				<tbody>
					{#each net as row (row.name)}
						<tr class="border-t border-outline-variant/40">
							<th
								scope="row"
								class="px-3 py-2 text-left font-semibold text-on-surface"
								style="overflow-wrap:anywhere"
							>
								{row.name}
							</th>
							<td class="px-2 py-2 text-right text-red-600 tabular-nums">−{row.out}</td>
							<td class="px-2 py-2 text-right text-emerald-700 tabular-nums">+{row.revert}</td>
							<td
								class="px-3 py-2 text-right font-bold tabular-nums {row.net === 0
									? 'text-gray-400'
									: 'text-on-surface'}"
							>
								{row.net > 0 ? `−${row.net}` : row.net < 0 ? `+${-row.net}` : '0'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<!-- Filtros -->
		<div class="mb-3 flex gap-1.5" role="group" aria-label="Filtrar movimientos">
			{#each filters as option (option.key)}
				<button
					type="button"
					onclick={() => (filter = option.key)}
					aria-pressed={filter === option.key}
					class="rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors {filter ===
					option.key
						? 'bg-brand-navy text-white'
						: 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'}"
				>
					{option.label}
				</button>
			{/each}
		</div>

		<!-- Grupos por operación (más reciente primero) -->
		<div class="space-y-4">
			{#each visibleGroups as group (group.key)}
				<section aria-label={group.title}>
					<h3
						class="mb-1.5 px-1 text-[13px] font-bold text-on-surface"
						style="overflow-wrap:anywhere"
					>
						{group.title}
					</h3>
					<ul class="space-y-1.5">
						{#each group.entries as entry (entry.id)}
							{@const out = isStockOut(entry.movementType)}
							<li
								class="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-outline-variant/60 bg-white px-3 py-1.5"
							>
								<span
									class="grid h-7 w-7 shrink-0 place-items-center rounded-full {out
										? 'bg-red-50 text-red-500'
										: 'bg-emerald-50 text-emerald-600'}"
									aria-hidden="true"
								>
									{#if out}
										<ArrowDown class="h-4 w-4" />
									{:else}
										<ArrowUp class="h-4 w-4" />
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span
										class="block truncate text-[13px] font-semibold text-on-surface"
										style="overflow-wrap:anywhere"
									>
										{entry.itemName ?? '—'}
									</span>
									<span class="block truncate text-xs text-outline" style="overflow-wrap:anywhere">
										{entry.notes ?? getInventoryMovementTypeLabel(entry.movementType)}
									</span>
								</span>
								<span
									class="shrink-0 text-sm font-bold tabular-nums {out
										? 'text-red-600'
										: 'text-emerald-700'}"
								>
									{out ? `−${Math.abs(entry.quantityDelta)}` : `+${entry.quantityDelta}`}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</SlideOver>
