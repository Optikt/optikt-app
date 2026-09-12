<script lang="ts">
	import { ArrowRight, CalendarDays, RotateCcw } from '@lucide/svelte';
	import { AppBadge, DataGrid } from '$lib/components/ui';
	import {
		formatInventoryCountScope,
		getInventoryCountStatusLabel,
		type InventoryCountScopeType
	} from '$lib/schemas/inventoryCount';
	import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';
	import { formatDate } from '$lib/utils';
	import { COUNT_SCOPE_OPTIONS, getCoveragePercent, getScopeLabel } from './countList';
	import { statusVariant } from './countSummary';

	interface Props {
		sessions: InventoryCountSessionSummary[];
		isHistoryLoading: boolean;
		historyResultCount: number;
		emptyTitle: string;
		emptySubtitle: string;
		historyScopeFilter: InventoryCountScopeType | '';
		historyOpenedOn: string;
		hasHistoryFilters: boolean;
		onToggleScope: (scope: InventoryCountScopeType) => void;
		onDayChange: () => void;
		onClear: () => void;
		onOpenSession: (sessionId: number) => void;
	}

	let {
		sessions,
		isHistoryLoading,
		historyResultCount,
		emptyTitle,
		emptySubtitle,
		historyScopeFilter = $bindable(),
		historyOpenedOn = $bindable(),
		hasHistoryFilters,
		onToggleScope,
		onDayChange,
		onClear,
		onOpenSession
	}: Props = $props();

	const columns = [
		{ key: 'session', label: 'Sesión' },
		{ key: 'scope', label: 'Alcance' },
		{ key: 'coverage', label: 'Cobertura' },
		{ key: 'result', label: 'Resultado' },
		{ key: 'status', label: 'Estado' },
		{ key: 'owner', label: 'Responsable' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];
</script>

<section
	class="glass-card border border-outline-variant/20 bg-surface-container-low p-4 shadow-sm sm:p-5"
>
	<div
		class="mb-2 flex flex-col gap-2 border-b border-outline-variant/15 pb-2 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
			<h2 class="text-lg font-semibold text-brand-navy">Historial de sesiones</h2>
			<p class="text-sm text-on-surface-variant">
				&mdash; {historyResultCount}
				{historyResultCount === 1 ? 'resultado' : 'resultados'}
			</p>
			{#if isHistoryLoading}
				<span class="text-xs font-semibold text-brand-blue">Actualizando...</span>
			{/if}
		</div>
	</div>

	<div class="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex flex-wrap items-center gap-2">
			{#each COUNT_SCOPE_OPTIONS as option (option.value)}
				<button
					type="button"
					onclick={() => onToggleScope(option.value)}
					aria-pressed={historyScopeFilter === option.value}
					class={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors ${historyScopeFilter === option.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-outline-variant/20 bg-surface-container text-on-surface-variant hover:border-brand-navy/25 hover:text-brand-navy'}`}
				>
					{option.label}
				</button>
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<span class="hidden text-outline lg:inline">&middot;</span>
			<label
				class="flex h-8 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container px-2.5 text-xs text-on-surface-variant"
			>
				<CalendarDays class="h-4 w-4 text-outline" />
				<span class="font-medium">Día</span>
				<input
					type="date"
					bind:value={historyOpenedOn}
					onchange={onDayChange}
					class="min-w-[10rem] border-none bg-transparent p-0 text-xs text-on-surface focus:ring-0"
				/>
			</label>

			<button
				type="button"
				onclick={onClear}
				disabled={!hasHistoryFilters}
				class="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-2.5 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
			>
				<RotateCcw class="h-4 w-4" />
				Limpiar
			</button>
		</div>
	</div>

	<DataGrid
		{columns}
		items={sessions}
		page={1}
		perPage={Math.max(sessions.length, 1)}
		total={sessions.length}
		totalPages={1}
		itemLabel="sesiones"
		{emptyTitle}
		{emptySubtitle}
		onPageChange={() => {}}
	>
		{#snippet row(session)}
			<tr
				class="bg-surface-container-lowest text-sm text-on-surface transition-colors hover:bg-surface-container-low"
			>
				<td class="px-4 py-3 align-top">
					<p class="font-semibold text-brand-navy">Sesión #{session.id}</p>
					<p class="mt-1 text-xs text-on-surface-variant">
						{formatDate(session.openedAt, { dateStyle: 'medium', timeStyle: 'short' })}
					</p>
				</td>
				<td class="px-4 py-3 align-top">
					<div class="space-y-2">
						<span
							class="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-brand-navy"
						>
							{formatInventoryCountScope(session.scopeType, session.scopeValue)}
						</span>
						<p class="text-xs text-on-surface-variant">
							{getScopeLabel(session.scopeType)}
						</p>
					</div>
				</td>
				<td class="px-4 py-3 align-top">
					<div class="min-w-[11rem] space-y-2">
						<div class="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
							<span>{session.countedLines} / {session.totalLines}</span>
							<span>{getCoveragePercent(session)}%</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-surface-container-high">
							<div
								class="h-full rounded-full bg-brand-blue"
								style={`width: ${getCoveragePercent(session)}%`}
							></div>
						</div>
						<p class="text-xs text-on-surface-variant">{session.pendingLines} pendientes</p>
					</div>
				</td>
				<td class="px-4 py-3 align-top">
					<div class="space-y-1 text-xs">
						<div class="flex items-center justify-between gap-3">
							<span class="text-on-surface-variant">+ Diferencias</span>
							<span class="font-semibold text-success">{session.positiveDifferences}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span class="text-on-surface-variant">- Diferencias</span>
							<span class="font-semibold text-error">{session.negativeDifferences}</span>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span class="text-on-surface-variant">OK</span>
							<span class="font-semibold text-brand-navy">{session.matchedLines}</span>
						</div>
					</div>
				</td>
				<td class="px-4 py-3">
					<AppBadge variant={statusVariant(session.status)}>
						{getInventoryCountStatusLabel(session.status)}
					</AppBadge>
				</td>
				<td class="px-4 py-3 align-top text-on-surface-variant">
					<p class="font-medium text-brand-navy">{session.openedByName ?? 'Usuario'}</p>
					<p class="mt-1 text-xs text-on-surface-variant">
						{#if session.status === 'APPLIED'}Aplicó: {session.appliedByName ??
								'—'}{:else if session.status === 'CANCELLED'}Cancelada{:else}Abierta{/if}
					</p>
				</td>
				<td class="px-4 py-3 text-right">
					<button
						type="button"
						onclick={() => onOpenSession(session.id)}
						class="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
					>
						{session.status === 'OPEN' ? 'Continuar' : 'Ver detalle'}
						<ArrowRight class="h-4 w-4" />
					</button>
				</td>
			</tr>
		{/snippet}

		{#snippet mobileCard(session)}
			<div class="space-y-3">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Sesión #{session.id}
						</p>
						<p class="mt-1 text-sm font-semibold text-brand-navy">
							{formatDate(session.openedAt, { dateStyle: 'medium', timeStyle: 'short' })}
						</p>
					</div>
					<AppBadge variant={statusVariant(session.status)}>
						{getInventoryCountStatusLabel(session.status)}
					</AppBadge>
				</div>

				<div class="flex flex-wrap gap-2">
					<span
						class="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-brand-navy"
					>
						{formatInventoryCountScope(session.scopeType, session.scopeValue)}
					</span>
				</div>

				<div class="grid grid-cols-3 gap-3 text-sm">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Cobertura
						</p>
						<p class="mt-1 font-semibold text-brand-navy">
							{session.countedLines}/{session.totalLines}
						</p>
					</div>
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">Diffs</p>
						<p class="mt-1 font-semibold text-brand-navy">
							+{session.positiveDifferences} / -{session.negativeDifferences}
						</p>
					</div>
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Responsable
						</p>
						<p class="mt-1 font-semibold text-brand-navy">{session.openedByName ?? '—'}</p>
					</div>
				</div>

				<button
					type="button"
					onclick={() => onOpenSession(session.id)}
					class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/35 bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
				>
					{session.status === 'OPEN' ? 'Continuar sesión' : 'Ver detalle'}
					<ArrowRight class="h-4 w-4" />
				</button>
			</div>
		{/snippet}
	</DataGrid>
</section>
