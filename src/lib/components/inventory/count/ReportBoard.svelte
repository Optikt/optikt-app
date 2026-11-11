<script lang="ts">
	import ItemCell from './ui/ItemCell.svelte';
	import { downloadCsv } from '$lib/utils/csv';
	import CountSegmented from './ui/CountSegmented.svelte';
	import CountLabel from './ui/CountLabel.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import ResponsibleStack from './ui/ResponsibleStack.svelte';
	import AppBadge from '$lib/components/ui/badges/AppBadge.svelte';
	import {
		lineDiff,
		finalCount,
		formatUsd,
		type CountSessionStats
	} from '$lib/shared/inventoryCount';
	import type {
		CountLineRow,
		CountSessionDetail,
		ResponsibleRow
	} from '$lib/server/db/queries/inventoryCount/types';

	type Dim = 'BRAND' | 'SUPPLIER' | 'TYPE';

	interface BreakdownRow {
		name: string;
		counted: number;
		matched: number;
		surplus: number;
		missing: number;
		adjusted: number;
		diffs: number;
		impact: number;
	}

	interface Props {
		session: CountSessionDetail;
		lines: CountLineRow[];
		costByLineId: Map<number, number | null>;
		stats: CountSessionStats;
		responsibles: ResponsibleRow[];
	}

	let { session, lines, costByLineId, stats, responsibles }: Props = $props();

	let dim = $state<Dim>('BRAND');

	const kpis = $derived.by(() => [
		{ label: 'Contados', value: String(stats.verified), hint: 'Ítems verificados en este conteo.' },
		{
			label: 'Coinciden',
			value: String(stats.matchCount),
			hint: 'Lo contado fue igual al sistema.'
		},
		{
			label: 'Diferencias',
			value: String(stats.diffCount),
			hint: `Faltan ${stats.missingUnits} u y sobran ${stats.surplusUnits} u.`
		},
		{
			label: 'Impacto est.',
			value: formatUsd(stats.impactCost),
			hint: 'Diferencia × costo de cada ítem. Negativo = pérdida.'
		}
	]);

	function keyOf(dim: Dim, line: CountLineRow): string {
		if (dim === 'BRAND') return line.brandName;
		if (dim === 'SUPPLIER') return line.supplierName;
		return line.typeLabel;
	}

	const rows = $derived.by((): BreakdownRow[] => {
		const groups: Record<string, BreakdownRow> = {};
		for (const line of lines) {
			const diff = lineDiff(line) ?? 0;
			const name = keyOf(dim, line);
			const row: BreakdownRow = groups[name] ?? {
				name,
				counted: 0,
				matched: 0,
				surplus: 0,
				missing: 0,
				adjusted: 0,
				diffs: 0,
				impact: 0
			};
			if (finalCount(line) != null) {
				row.counted += 1;
				if (diff === 0) row.matched += 1;
				else {
					row.diffs += 1;
					if (diff > 0) row.surplus += diff;
					else row.missing += Math.abs(diff);
					row.impact += diff * (costByLineId.get(line.id) ?? 0);
					if (line.adjustmentMovementId != null) row.adjusted += 1;
				}
			}
			groups[name] = row;
		}
		return Object.values(groups).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
	});

	const maxImpact = $derived(Math.max(1, ...rows.map((row) => Math.abs(row.impact))));

	const diffLines = $derived(
		lines
			.map((line) => ({ line, diff: lineDiff(line) ?? 0 }))
			.filter((entry) => entry.diff !== 0 && finalCount(entry.line) != null)
	);

	function exportExcel(): void {
		downloadCsv(
			`conteo-${session.id}`,
			['Nombre', 'Contados', 'Coinciden', 'Sobran', 'Faltan', 'Ajustes', 'Impacto USD'],
			rows.map((row) => [
				row.name,
				String(row.counted),
				String(row.matched),
				String(row.surplus),
				String(row.missing),
				`${row.adjusted}/${row.diffs}`,
				row.impact.toFixed(2)
			])
		);
	}
</script>

<section class="flex flex-col gap-3 px-4 py-4">
	{#if session.status === 'CANCELLED'}
		<div class="mx-auto max-w-md rounded-xl bg-white p-4 text-center shadow-[var(--ds-shadow-md)]">
			<AppBadge variant="neutral">Cancelado</AppBadge>
			<p class="mt-3 text-sm"><b>Motivo:</b> {session.cancelReason || 'Sin motivo registrado'}</p>
			<p class="text-sm text-on-surface-variant">
				Alcance: {session.scopeLabel} · {session.totalItemsCounted ?? stats.verified} ítems contados
			</p>
			<ResponsibleStack {responsibles} />
			<p class="mt-3 text-xs text-on-surface-variant">
				Sin dashboard de métricas para conteos cancelados
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each kpis as kpi (kpi.label)}
				<TriggerTooltip title={kpi.label} text={kpi.hint} side="bottom">
					{#snippet trigger({ props })}
						<button
							type="button"
							{...props}
							class="rounded-lg bg-surface-container-low px-4 py-3 text-left"
						>
							<CountLabel text={kpi.label} />
							<p class="font-heading mt-1 text-[26px] font-bold text-brand-navy tabular-nums">
								{kpi.value}
							</p>
						</button>
					{/snippet}
				</TriggerTooltip>
			{/each}
		</div>

		<div
			class="card flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-[var(--ds-shadow-md)]"
		>
			<span class="text-sm">
				Cobertura del ciclo
				<b class="text-brand-navy tabular-nums">
					{session.coverageBefore ?? '—'} % → {session.coverageAfter ?? '—'} %
				</b>
			</span>
			<span class="text-sm text-on-surface-variant">
				{session.openedAt ? new Date(session.openedAt).toLocaleString() : ''} →
				{session.appliedAt ? new Date(session.appliedAt).toLocaleString() : ''}
			</span>
			<ResponsibleStack {responsibles} tooltipTitle="Responsables del conteo" />
			<span class="ml-auto flex gap-2 print:hidden">
				<button
					type="button"
					class="rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-navy-dark"
					onclick={() => window.print()}
				>
					Imprimir
				</button>
				<button
					type="button"
					class="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#1e4f5e] hover:bg-surface-container"
					onclick={() => window.print()}
				>
					PDF
				</button>
				<button
					type="button"
					class="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#1e4f5e] hover:bg-surface-container"
					onclick={exportExcel}
				>
					Excel
				</button>
			</span>
		</div>

		<div class="rounded-xl bg-white p-4 shadow-[var(--ds-shadow-md)]">
			<CountSegmented
				value={dim}
				ariaLabel="Desglose por dimensión"
				options={[
					{
						value: 'BRAND',
						label: 'Por marca',
						tooltip: 'Qué se movió por marca|Resumen de contados, diferencias e impacto.'
					},
					{
						value: 'SUPPLIER',
						label: 'Por proveedor',
						tooltip: 'Qué se movió por proveedor|Resumen de contados, diferencias e impacto.'
					},
					{
						value: 'TYPE',
						label: 'Por tipo',
						tooltip: 'Qué se movió por tipo|Resumen de contados, diferencias e impacto.'
					}
				]}
				onchange={(value) => (dim = value as Dim)}
			/>
			<div class="mt-3 overflow-auto">
				<table class="w-full text-sm">
					<thead>
						<tr
							class="bg-surface-container-low text-xs font-semibold text-on-surface-variant uppercase"
						>
							<th class="px-3 text-left"
								>{dim === 'BRAND' ? 'Marca' : dim === 'SUPPLIER' ? 'Proveedor' : 'Tipo'}</th
							>
							<th class="text-right">Contados</th>
							<th class="text-right">Coinciden</th>
							<th class="text-right">Sobran</th>
							<th class="text-right">Faltan</th>
							<th class="text-right">Ajustes</th>
							<th class="text-right">Impacto</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-outline-variant/40">
						{#each rows as row (row.name)}
							<tr>
								<td class="px-3 py-2 font-medium text-brand-navy">{row.name}</td>
								<td class="px-3 py-2 text-right tabular-nums">{row.counted}</td>
								<td class="px-3 py-2 text-right tabular-nums">{row.matched}</td>
								<td class="px-3 py-2 text-right tabular-nums">+{row.surplus}</td>
								<td class="px-3 py-2 text-right tabular-nums">−{row.missing}</td>
								<td class="px-3 py-2 text-right tabular-nums">{row.adjusted}/{row.diffs}</td>
								<td class="px-3 py-2 text-right tabular-nums">
									<i
										class="mr-1.5 inline-block h-1.5 w-9 rounded"
										style={`background:${row.impact < 0 ? 'var(--color-error)' : 'var(--color-warning)'};opacity:${Math.max(0.2, Math.abs(row.impact) / maxImpact)}`}
									></i>
									{formatUsd(row.impact)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="rounded-xl bg-white p-4 shadow-[var(--ds-shadow-md)]">
			<p class="text-sm font-semibold text-brand-navy">Detalle de diferencias</p>
			<div class="mt-2 overflow-x-auto">
				<table class="w-full text-sm">
					<thead
						class="bg-surface-container-high text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
					>
						<tr>
							<th class="px-2 py-2 text-left font-semibold">Ítem</th>
							<th class="px-2 py-2 text-right font-semibold">Sistema → Contado</th>
							<th class="px-2 py-2 text-right font-semibold">Dif.</th>
							<th class="px-2 py-2 text-right font-semibold">Impacto</th>
							<th class="px-2 py-2 text-right font-semibold">Estado</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-outline-variant/40">
						{#each diffLines as entry (entry.line.id)}
							<tr>
								<td class="px-2 py-2">
									<span class="block max-w-56"
										><ItemCell
											itemName={entry.line.itemName}
											itemCode={entry.line.itemCode}
											itemType={entry.line.itemType}
											productId={entry.line.productId}
											lensCatalogItemId={entry.line.lensCatalogItemId}
										/></span
									>
								</td>
								<td class="px-2 py-2 text-right text-on-surface-variant tabular-nums">
									{entry.line.systemStock} → {finalCount(entry.line)}
								</td>
								<td
									class="px-2 py-2 text-right {entry.diff > 0
										? 'text-success tabular-nums'
										: 'text-error tabular-nums'}"
								>
									{entry.diff > 0 ? `+${entry.diff}` : `${entry.diff}`}
								</td>
								<td class="px-2 py-2 text-right text-on-surface-variant tabular-nums">
									{formatUsd(entry.diff * (costByLineId.get(entry.line.id) ?? 0))}
								</td>
								<td class="px-2 py-2 text-right text-xs">
									{entry.line.adjustmentMovementId ? 'Ajustado' : 'Ajuste pendiente'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if diffLines.length === 0}
					<p class="py-3 text-center text-sm text-on-surface-variant">Sin diferencias</p>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	@media print {
		/* El shell ya está oculto globalmente (navbar/sidebar). Limpia fondos y sobra espacio. */
		:global(body) {
			background: #fff;
		}
		section {
			box-shadow: none !important;
			border: 1px solid #e2e8f0;
		}
	}
</style>
