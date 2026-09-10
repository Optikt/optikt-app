<script lang="ts">
	import { AppBadge } from '$lib/components/ui';
	import type { InventoryCountSessionDetail } from '$lib/server/db/queries/inventoryCount';
	import {
		compactStatClass,
		lifecycleSummaryFor,
		openedSummaryFor,
		scopeLabelFor,
		statusLabelFor,
		statusVariant,
		type CountStats,
		type SummaryMetric
	} from './countSummary';

	interface Props {
		session: InventoryCountSessionDetail;
		stats: CountStats;
		metrics: SummaryMetric[];
		messageLabel: string;
		message: string;
	}

	let { session, stats, metrics, messageLabel, message }: Props = $props();

	const statusLabel = $derived(statusLabelFor(session.status));
	const scopeLabel = $derived(scopeLabelFor(session));
	const openedSummary = $derived(openedSummaryFor(session));
	const lifecycleSummary = $derived(lifecycleSummaryFor(session));
	const hasSessionNotes = $derived(Boolean(session.notes?.trim()));
</script>

<section
	class="grid gap-2 border-b border-outline-variant/15 pb-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]"
>
	<div class="min-w-0 space-y-2">
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<AppBadge variant={statusVariant(session.status)}>{statusLabel}</AppBadge>
			<span class="font-medium text-brand-navy">Alcance: {scopeLabel}</span>
			{#if hasSessionNotes}
				<span
					class="inline-flex rounded-full bg-brand-gold/15 px-2.5 py-1 text-[11px] font-semibold text-brand-navy"
				>
					Con notas
				</span>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-on-surface-variant">
			<p class="min-w-0">{openedSummary}</p>
			{#if lifecycleSummary}
				<span class="text-outline">·</span>
				<p class="min-w-0 truncate" title={lifecycleSummary}>{lifecycleSummary}</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm text-on-surface-variant">
			<span>
				Pendientes:
				<span class="font-semibold text-brand-gold tabular-nums">{stats.pending}</span>
			</span>
			<span>
				OK:
				<span class="font-semibold text-success tabular-nums">{stats.matchedCount}</span>
			</span>
			<span>
				+Dif:
				<span class="font-semibold text-success tabular-nums"
					>{stats.positiveDiffCount}/+{stats.positiveUnits}</span
				>
			</span>
			<span>
				-Dif:
				<span class="font-semibold text-error tabular-nums"
					>{stats.negativeDiffCount}/-{stats.negativeUnits}</span
				>
			</span>
		</div>

		<div class="flex flex-col gap-1 pt-0.5 sm:flex-row sm:items-center">
			<div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
				<div
					class="h-full rounded-full bg-brand-blue transition-all duration-200"
					style={`width: ${stats.progressPercent}%`}
				></div>
			</div>
			<p class="text-sm font-medium text-brand-navy tabular-nums">
				{stats.counted} / {stats.total} líneas · {stats.progressPercent}%
			</p>
		</div>
	</div>

	<div
		class="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-2.5 shadow-sm"
	>
		<div class="grid gap-1.5 sm:grid-cols-2">
			{#each metrics as metric (metric.id)}
				<div class="rounded-xl bg-surface-container-low px-2.5 py-2">
					<p class="text-[11px] font-semibold tracking-[0.14em] text-outline uppercase">
						{metric.label}
					</p>
					<p
						class={`mt-0.5 font-mono text-[15px] font-semibold tabular-nums ${compactStatClass(metric.tone)}`}
					>
						{metric.value}
					</p>
				</div>
			{/each}
		</div>

		<div class="mt-1.5 border-t border-outline-variant/15 pt-2">
			<p class="text-[11px] font-semibold tracking-[0.14em] text-outline uppercase">
				{messageLabel}
			</p>
			<p
				class="mt-0.5 text-sm leading-5 text-on-surface-variant lg:truncate"
				title={message}
			>
				{message}
			</p>
		</div>
	</div>
</section>
