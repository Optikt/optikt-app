<script lang="ts">
	import { ArrowRightLeft, Ban, CircleX, HandCoins, Pencil, Plus } from '@lucide/svelte';
	import {
		auditChangeCountLabel,
		auditDiffRows,
		hasAuditDetail,
		type AuditEvent
	} from '$lib/utils/saleDetail';
	import { formatDate, formatPrice } from '$lib/utils';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { getSaleStatusLabel } from '$lib/shared/enums';
	import type { SaleAuditItemChange } from '$lib/schemas/sales';

	interface Props {
		event: AuditEvent;
		/** Compact spacing for the overview card (drawer uses the default). */
		dense?: boolean;
		/** Start expanded (the drawer opens the linked event expanded). */
		expanded?: boolean;
		/** Rail only: open the drawer with this event expanded. */
		onExpand?: (id: string) => void;
	}

	let { event, dense = false, expanded = false, onExpand }: Props = $props();

	let open = $state(false);

	$effect(() => {
		if (expanded) open = true;
	});

	const rows = $derived(auditDiffRows(event));
	const detail = $derived(hasAuditDetail(event));
	const diff = $derived(event.itemsDiff);
	const added = $derived(
		diff?.items.filter((c): c is Extract<SaleAuditItemChange, { t: 'add' }> => c.t === 'add') ?? []
	);
	const removed = $derived(
		diff?.items.filter((c): c is Extract<SaleAuditItemChange, { t: 'del' }> => c.t === 'del') ?? []
	);
	const swapped = $derived(
		diff?.items.filter((c): c is Extract<SaleAuditItemChange, { t: 'swap' }> => c.t === 'swap') ??
			[]
	);
	const modified = $derived(
		diff?.items.filter((c): c is Extract<SaleAuditItemChange, { t: 'mod' }> => c.t === 'mod') ?? []
	);
	const showDeltaChip = $derived(
		event.totalDelta !== null && event.totalDelta !== 0 && event.changeCount > 0
	);
	const deltaPositive = $derived((event.totalDelta ?? 0) > 0);
	const toggleLabel = $derived(
		open
			? 'Ocultar'
			: event.changeCount === 1
				? 'Ver el cambio'
				: event.changeCount > 1
					? `Ver los ${event.changeCount} cambios`
					: 'Ver cambios'
	);
	const summaryLabel = $derived(
		`${auditChangeCountLabel(event)}${showDeltaChip ? ` · Total ${formatDelta(event.totalDelta ?? 0)}` : ''} →`
	);
	const statusPills = $derived(readStatusPills(event));

	function readStatusPills(event: AuditEvent): { from: string | null; to: string } | null {
		if (event.kind !== 'status' || !event.changes) return null;
		const change = (event.changes as Record<string, { old?: unknown; new?: unknown } | undefined>)
			.status;
		if (!change || typeof change.new !== 'string') return null;
		const from = typeof change.old === 'string' ? getSaleStatusLabel(change.old) : null;
		return { from, to: getSaleStatusLabel(change.new) };
	}

	function formatDelta(delta: number): string {
		const sign = delta > 0 ? '+' : '-';
		return `${sign}${formatPrice(Math.abs(delta))}`;
	}

	function iconBg(kind: AuditEvent['kind']): string {
		if (kind === 'create') return 'bg-brand-navy text-white';
		if (kind === 'status') return 'bg-brand-blue text-white';
		if (kind === 'cancel' || kind === 'paymentVoid') return 'bg-error text-white';
		if (kind === 'payment') return 'bg-emerald-600 text-white';
		return 'bg-outline-variant text-on-surface-variant';
	}

	/**
	 * `antes → después`, but a missing `antes` renders as just `→ después`
	 * (never a dangling `- →`).
	 */
	function hasBefore(value: string | null | undefined): boolean {
		return value !== null && value !== undefined && value !== '' && value !== '-' && value !== '—';
	}
</script>

{#snippet beforeAfter(from: string | null | undefined, to: string | null | undefined)}
	{#if hasBefore(from)}{from} <span aria-hidden="true"> → </span>{:else}<span aria-hidden="true"
			>→
		</span>{/if}{to ?? '—'}
{/snippet}

<div class="relative {dense ? 'py-1.5 pr-2 pl-10' : 'py-2 pr-4 pl-10'}">
	<!-- Continuous timeline line behind the icon -->
	<span class="absolute top-0 bottom-0 left-5 w-0.5 bg-outline-variant/60"></span>
	<span
		class="absolute top-2.5 left-[13px] grid h-5 w-5 place-items-center rounded-full {iconBg(
			event.kind
		)}"
	>
		{#if event.kind === 'create'}
			<Plus class="h-3 w-3" />
		{:else if event.kind === 'status'}
			<ArrowRightLeft class="h-3 w-3" />
		{:else if event.kind === 'cancel'}
			<CircleX class="h-3 w-3" />
		{:else if event.kind === 'payment'}
			<HandCoins class="h-3 w-3" />
		{:else if event.kind === 'paymentVoid'}
			<Ban class="h-3 w-3" />
		{:else}
			<Pencil class="h-3 w-3" />
		{/if}
	</span>

	<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
		<p class="text-[13px] leading-snug font-semibold text-on-surface">{event.label}</p>
		{#if showDeltaChip}
			{#snippet deltaTip({ props }: { props: Record<string, unknown> })}
				<span
					{...props}
					class="inline-flex h-5 cursor-help items-center rounded-full px-2 text-[11px] font-bold tabular-nums {deltaPositive
						? 'bg-emerald-50 text-emerald-700'
						: 'bg-red-50 text-red-700'}"
				>
					Total {formatDelta(event.totalDelta ?? 0)}
				</span>
			{/snippet}
			<TriggerTooltip trigger={deltaTip} text="Diferencia del total tras la edición" />
		{/if}
		{#if statusPills}
			<span class="inline-flex items-center gap-1 text-[11px] font-semibold">
				{#if statusPills.from}
					<span
						class="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant line-through"
						>{statusPills.from}</span
					>
					<span aria-hidden="true" class="text-outline">→</span>
				{/if}
				<span class="rounded-full bg-brand-blue/10 px-2 py-0.5 text-brand-blue"
					>{statusPills.to}</span
				>
			</span>
		{/if}
	</div>
	<p class="mt-0.5 text-xs text-on-surface-variant">
		{event.changedByName ?? 'Usuario desconocido'} · {formatDate(event.changedAt, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})}
	</p>
	{#if event.note}
		<p class="mt-0.5 text-xs text-on-surface-variant">{event.note}</p>
	{/if}
	{#if event.paymentAmount !== null}
		<p class="mt-0.5 text-[13px] font-bold text-on-surface tabular-nums">
			{formatPrice(event.paymentAmount)}
		</p>
	{/if}
	{#if event.reason}
		<p
			class="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs [overflow-wrap:anywhere] break-words text-amber-900"
		>
			<span class="font-bold tracking-[0.08em] uppercase">Motivo · </span>{event.reason}
		</p>
	{/if}

	{#if dense}
		{#if event.changeCount > 0 && onExpand}
			<button
				type="button"
				onclick={() => onExpand(event.id)}
				class="mt-1 text-xs font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
			>
				{summaryLabel}
			</button>
		{/if}
	{:else if event.legacyUpdate}
		<p class="mt-1 text-xs text-on-surface-variant italic">
			Sin detalle de cambios registrado (evento anterior al registro detallado)
		</p>
	{:else if detail}
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			class="mt-1 text-xs font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
		>
			{toggleLabel}
		</button>
		<div
			class="grid transition-[grid-template-rows] duration-[250ms] ease-out {open
				? 'grid-rows-[1fr]'
				: 'grid-rows-[0fr]'}"
		>
			<div class="overflow-hidden">
				<div class="mt-1.5 mb-1 space-y-3 rounded-lg bg-surface-container-low px-3 py-2.5 text-xs">
					{#if added.length + removed.length + swapped.length + modified.length > 0}
						<section>
							<h4 class="text-[10px] font-bold tracking-[0.14em] text-outline uppercase">
								Artículos
							</h4>
							<ul class="mt-1 space-y-1">
								{#each added as change, i (change.name + change.total + i)}
									<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
										<span class="font-bold text-emerald-700">+</span>
										<span class="font-semibold text-on-surface">{change.name}</span>
										×{change.qty} · {formatPrice(change.total)}
									</li>
								{/each}
								{#each removed as change, i (change.name + change.total + i)}
									<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
										<span class="font-bold text-red-700">−</span>
										<span class="font-semibold text-on-surface">{change.name}</span>
										×{change.qty} · {formatPrice(change.total)}
									</li>
								{/each}
								{#each swapped as change, i (change.from.name + change.to.name + i)}
									<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
										<span class="font-bold text-brand-blue">⇄</span>
										<span class="line-through">{change.from.name}</span>
										<span aria-hidden="true"> → </span>
										<span class="font-semibold text-on-surface">{change.to.name}</span>
										<span class="tabular-nums">
											({formatPrice(change.from.total)} → {formatPrice(change.to.total)})
										</span>
									</li>
								{/each}
								{#each modified as change, i (change.name + i)}
									<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
										<span class="font-bold text-brand-blue">✎</span>
										<span class="font-semibold text-on-surface">{change.name}</span>
										<ul class="mt-0.5 space-y-0.5 pl-4">
											{#each change.fields as field (field.key)}
												<li>
													{field.label}: {@render beforeAfter(field.from, field.to)}
												</li>
											{/each}
										</ul>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
					{#if diff && diff.header.length > 0}
						<section>
							<h4 class="text-[10px] font-bold tracking-[0.14em] text-outline uppercase">Datos</h4>
							<ul class="mt-1 space-y-1">
								{#each diff.header as row (row.key)}
									<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
										<span class="font-semibold text-on-surface">{row.label}:</span>
										{@render beforeAfter(row.from, row.to)}
									</li>
								{/each}
							</ul>
						</section>
					{/if}
					{#if diff && diff.totals.length > 0}
						<section>
							<h4 class="text-[10px] font-bold tracking-[0.14em] text-outline uppercase">
								Totales
							</h4>
							<ul class="mt-1 space-y-1">
								{#each diff.totals as row (row.label)}
									<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
										<span class="font-semibold text-on-surface">{row.label}:</span>
										{formatPrice(row.from)} →
										{formatPrice(row.to)}
										<span class="font-bold tabular-nums">
											({row.to - row.from >= 0 ? '+' : '−'}{formatPrice(
												Math.abs(row.to - row.from)
											)})
										</span>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
					{#if diff?.truncated}
						<p class="text-on-surface-variant italic">
							+{diff.truncated} cambios más (tope 50)
						</p>
					{/if}
					{#if rows.length > 0}
						<ul class="space-y-1 border-t border-outline-variant/40 pt-2">
							{#each rows as row (row.field)}
								<li class="[overflow-wrap:anywhere] break-words text-on-surface-variant">
									<span class="font-semibold text-on-surface">{row.label}:</span>
									{@render beforeAfter(row.from, row.to)}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	{:else if event.reason}
		<!-- Reason already rendered in the highlighted box above; nothing else to show. -->
	{/if}
</div>
