<script lang="ts">
	import {
		ArrowRight,
		Boxes,
		CalendarDays,
		CheckCircle2,
		ClipboardList,
		Clock3,
		Layers3,
		PackageSearch,
		Play,
		Plus,
		RotateCcw,
		ScanSearch,
		X
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { AppBadge, DataGrid } from '$lib/components/ui';
	import {
		createSession,
		getSessions as getSessionsQuery
	} from '$lib/remote/inventoryCount.remote';
	import {
		formatInventoryCountScope,
		getInventoryCountStatusLabel,
		type InventoryCountScopeType
	} from '$lib/schemas/inventoryCount';
	import { ALL_PRODUCT_TYPES, PRODUCT_TYPE_LABELS, type ProductType } from '$lib/shared/enums';
	import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';
	import { formatDate, getErrorMessage } from '$lib/utils';

	let { data } = $props();
	const initialData = untrack(() => ({
		activeSession: data.activeSession ?? null,
		sessions: data.sessions
	}));
	let activeSession = $state<InventoryCountSessionSummary | null>(initialData.activeSession);
	let summarySessions = $state<InventoryCountSessionSummary[]>(initialData.sessions);
	let historySessions = $state<InventoryCountSessionSummary[]>(initialData.sessions);
	let showCreateModal = $state(false);
	let scopeType = $state<InventoryCountScopeType>('ALL');
	let scopeValue = $state<ProductType | ''>('');
	let notes = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);
	let historyScopeFilter = $state<InventoryCountScopeType | ''>('');
	let historyOpenedOn = $state('');
	let isHistoryLoading = $state(false);
	let historyRequestId = 0;

	const totalSessions = $derived(summarySessions.length);
	const openSessionsCount = $derived(
		summarySessions.filter((session) => session.status === 'OPEN').length
	);
	const recentlyAppliedCount = $derived(
		summarySessions.filter(
			(session) => session.status === 'APPLIED' && isWithinLastDays(session.appliedAt, 14)
		).length
	);
	const totalAuditedItems = $derived(
		summarySessions.reduce(
			(sum, session) => sum + (session.totalItemsCounted ?? session.countedLines ?? 0),
			0
		)
	);
	const hasHistoryFilters = $derived(Boolean(historyScopeFilter || historyOpenedOn));
	const historyResultCount = $derived(historySessions.length);
	const historyEmptyTitle = $derived(
		hasHistoryFilters ? 'No hay sesiones para este filtro' : 'Sin sesiones registradas'
	);
	const historyEmptySubtitle = $derived(
		hasHistoryFilters
			? 'Prueba otro alcance o cambia el día seleccionado'
			: 'Inicia el primer conteo físico para comenzar el historial operativo'
	);

	const columns = [
		{ key: 'session', label: 'Sesión' },
		{ key: 'scope', label: 'Alcance' },
		{ key: 'coverage', label: 'Cobertura' },
		{ key: 'result', label: 'Resultado' },
		{ key: 'status', label: 'Estado' },
		{ key: 'owner', label: 'Responsable' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	const scopeOptions = [
		{
			value: 'ALL' as const,
			label: 'Todo el inventario',
			description: 'Audita productos y lentes STOCK en una sola sesión.',
			icon: Layers3
		},
		{
			value: 'PRODUCT_CATEGORY' as const,
			label: 'Solo productos',
			description: 'Cuenta todos los productos o enfócate en una categoría concreta.',
			icon: PackageSearch
		},
		{
			value: 'LENS' as const,
			label: 'Solo lentes STOCK',
			description: 'Revisa exclusivamente lentes con inventario físico.',
			icon: ScanSearch
		}
	] satisfies Array<{
		value: InventoryCountScopeType;
		label: string;
		description: string;
		icon: typeof Layers3;
	}>;

	function statusVariant(status: string) {
		if (status === 'OPEN') return 'warning';
		if (status === 'APPLIED') return 'success';
		return 'neutral';
	}

	function isWithinLastDays(timestamp: string | null | undefined, days: number) {
		if (!timestamp) {
			return false;
		}

		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) {
			return false;
		}

		const daysWindow = days * 24 * 60 * 60 * 1000;
		return Date.now() - date.getTime() <= daysWindow;
	}

	function getCoveragePercent(session: InventoryCountSessionSummary) {
		if (session.totalLines === 0) {
			return 0;
		}

		return Math.round((session.countedLines / session.totalLines) * 100);
	}

	function getScopeLabel(scopeType: InventoryCountScopeType) {
		return scopeOptions.find((option) => option.value === scopeType)?.label ?? scopeType;
	}

	function selectScope(nextScope: InventoryCountScopeType) {
		scopeType = nextScope;

		if (nextScope !== 'PRODUCT_CATEGORY') {
			scopeValue = '';
		}
	}

	function openCreateModal() {
		formError = '';
		scopeType = 'ALL';
		scopeValue = '';
		notes = '';
		showCreateModal = true;
	}

	async function handleCreateSession() {
		if (isSubmitting) {
			return;
		}

		isSubmitting = true;
		formError = '';

		try {
			const result = await createSession({
				scopeType,
				scopeValue: scopeType === 'PRODUCT_CATEGORY' && scopeValue !== '' ? scopeValue : null,
				notes: notes.trim() || null
			});

			if (!result.success) {
				formError = result.error ?? 'No se pudo iniciar la sesión';
				toast.error(formError);
				return;
			}

			const nextSummarySessions = [
				result.session,
				...summarySessions.filter((session) => session.id !== result.session.id)
			];
			summarySessions = nextSummarySessions;
			if (!historyScopeFilter && !historyOpenedOn) {
				historySessions = nextSummarySessions;
			}
			activeSession = result.session;
			showCreateModal = false;
			await goto(resolve(`/inventory/count/${result.session.id}`));
		} catch (error) {
			console.error(error);
			formError = getErrorMessage(error, 'No se pudo iniciar la sesión');
			toast.error(formError);
		} finally {
			isSubmitting = false;
		}
	}

	function goToSession(sessionId: number) {
		goto(resolve(`/inventory/count/${sessionId}`));
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !isSubmitting) {
			showCreateModal = false;
		}
	}

	async function refreshHistorySessions() {
		historyRequestId += 1;
		const requestId = historyRequestId;

		if (!historyScopeFilter && !historyOpenedOn) {
			isHistoryLoading = false;
			historySessions = summarySessions;
			return;
		}

		isHistoryLoading = true;

		try {
			const nextSessions = await getSessionsQuery({
				limit: 100,
				scopeType: historyScopeFilter || undefined,
				openedOn: historyOpenedOn || undefined
			}).run();

			if (requestId !== historyRequestId) {
				return;
			}

			historySessions = nextSessions;
		} catch (error) {
			if (requestId !== historyRequestId) {
				return;
			}

			console.error(error);
			toast.error(getErrorMessage(error, 'No se pudo filtrar el historial'));
		} finally {
			if (requestId === historyRequestId) {
				isHistoryLoading = false;
			}
		}
	}

	function toggleHistoryScopeFilter(nextScope: InventoryCountScopeType) {
		historyScopeFilter = historyScopeFilter === nextScope ? '' : nextScope;
		void refreshHistorySessions();
	}

	function applyHistoryDayFilter() {
		void refreshHistorySessions();
	}

	function clearHistoryFilters() {
		historyRequestId += 1;
		historyScopeFilter = '';
		historyOpenedOn = '';
		isHistoryLoading = false;
		historySessions = summarySessions;
	}
</script>

<svelte:head>
	<title>Conteo Físico - Optikt</title>
</svelte:head>

<div class="space-y-4 p-4 sm:space-y-5 sm:p-6">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div class="min-w-0">
			<h1 class="font-heading text-2xl font-bold tracking-[-0.03em] text-brand-navy sm:text-3xl">
				Conteo Físico
			</h1>
			<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
				<span>Historial y gestión de sesiones de inventario</span>
				<span class="hidden text-outline sm:inline">•</span>
				<span>Últimas 2 semanas: {recentlyAppliedCount} sesiones</span>
				<span class="hidden text-outline sm:inline">•</span>
				<span>Cobertura acumulada: {totalAuditedItems} ítems</span>
			</div>
		</div>

		<div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
			{#if activeSession}
				<button
					type="button"
					onclick={() => activeSession && goToSession(activeSession.id)}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
				>
					<Play class="h-4 w-4" />
					Continuar sesión
				</button>
			{:else}
				<button
					type="button"
					onclick={openCreateModal}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-gold-dark"
				>
					<Plus class="h-4 w-4" />
					Nueva sesión
				</button>
			{/if}
		</div>
	</div>

	<section
		class="glass-card border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 shadow-sm"
	>
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex min-w-0 items-center gap-2 text-sm">
				<span
					class={`h-2.5 w-2.5 rounded-full ${activeSession ? 'bg-warning' : 'bg-success'}`}
					aria-hidden="true"
				></span>
				<p class="truncate font-semibold text-brand-navy">
					{activeSession ? `Sesión #${activeSession.id} en progreso` : 'Sin sesión activa'}
				</p>
			</div>

			{#if activeSession}
				<div class="flex flex-wrap gap-2">
					<span
						class="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-brand-navy"
					>
						{formatInventoryCountScope(activeSession.scopeType, activeSession.scopeValue)}
					</span>
					<span
						class="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant"
					>
						{activeSession.pendingLines} pendientes
					</span>
				</div>
			{:else}
				<p class="text-xs font-medium text-on-surface-variant">
					Sin bloqueos activos; usa el historial para revisar sesiones previas.
				</p>
			{/if}
		</div>
	</section>

	<section class="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<div
			class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="space-y-1">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
					Sesiones totales
				</p>
				<p class="text-2xl font-semibold text-brand-navy">{totalSessions}</p>
				<p class="text-xs text-on-surface-variant">historial cargado en pantalla</p>
			</div>
			<div
				class="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container text-brand-navy"
			>
				<ClipboardList class="h-4.5 w-4.5" />
			</div>
		</div>

		<div
			class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="space-y-1">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
					Sesiones abiertas
				</p>
				<p class="text-2xl font-semibold text-brand-navy">{openSessionsCount}</p>
				<p class="text-xs text-on-surface-variant">
					{#if activeSession}requieren atención inmediata{:else}sin bloqueos activos{/if}
				</p>
			</div>
			<div
				class="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning-container/60 text-on-warning-container"
			>
				<Clock3 class="h-4.5 w-4.5" />
			</div>
		</div>

		<div
			class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="space-y-1">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
					Aplicadas recientes
				</p>
				<p class="text-2xl font-semibold text-brand-navy">{recentlyAppliedCount}</p>
				<p class="text-xs text-on-surface-variant">últimos 14 días</p>
			</div>
			<div
				class="flex h-10 w-10 items-center justify-center rounded-2xl bg-success-container/60 text-success"
			>
				<CheckCircle2 class="h-4.5 w-4.5" />
			</div>
		</div>

		<div
			class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="space-y-1">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
					Ítems auditados
				</p>
				<p class="text-2xl font-semibold text-brand-navy">{totalAuditedItems}</p>
				<p class="text-xs text-on-surface-variant">conteos registrados en historial</p>
			</div>
			<div
				class="flex h-10 w-10 items-center justify-center rounded-2xl bg-info-container/60 text-brand-blue"
			>
				<Boxes class="h-4.5 w-4.5" />
			</div>
		</div>
	</section>

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
				{#each scopeOptions as option (option.value)}
					<button
						type="button"
						onclick={() => toggleHistoryScopeFilter(option.value)}
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
						onchange={applyHistoryDayFilter}
						class="min-w-[10rem] border-none bg-transparent p-0 text-xs text-on-surface focus:ring-0"
					/>
				</label>

				<button
					type="button"
					onclick={clearHistoryFilters}
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
			items={historySessions}
			page={1}
			perPage={Math.max(historySessions.length, 1)}
			total={historySessions.length}
			totalPages={1}
			itemLabel="sesiones"
			emptyTitle={historyEmptyTitle}
			emptySubtitle={historyEmptySubtitle}
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
								{getScopeLabel(session.scopeType as InventoryCountScopeType)}
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
							onclick={() => goToSession(session.id)}
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
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Diffs
							</p>
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
						onclick={() => goToSession(session.id)}
						class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/35 bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
					>
						{session.status === 'OPEN' ? 'Continuar sesión' : 'Ver detalle'}
						<ArrowRight class="h-4 w-4" />
					</button>
				</div>
			{/snippet}
		</DataGrid>
	</section>

	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget && !isSubmitting) {
					showCreateModal = false;
				}
			}}
			onkeydown={handleModalKeydown}
			tabindex="-1"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="inventory-count-create-title"
				class="w-full max-w-4xl rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Nuevo conteo
						</p>
						<h2
							id="inventory-count-create-title"
							class="mt-1 text-xl font-semibold text-brand-navy"
						>
							Iniciar sesión
						</h2>
					</div>

					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						disabled={isSubmitting}
						class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-navy"
						aria-label="Cerrar modal"
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				<div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
					<div class="space-y-5">
						<div class="space-y-2">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Alcance del conteo
							</span>
							<div class="grid gap-3 md:grid-cols-3">
								{#each scopeOptions as option (option.value)}
									{@const ScopeIcon = option.icon}
									<button
										type="button"
										onclick={() => selectScope(option.value)}
										aria-pressed={scopeType === option.value}
										class={`cursor-pointer rounded-2xl border px-4 py-4 text-left transition-colors ${scopeType === option.value ? 'border-brand-navy bg-brand-navy text-white' : 'border-outline-variant/20 bg-surface-container text-on-surface hover:border-brand-navy/25 hover:bg-surface-container-high'}`}
									>
										<div
											class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-current"
										>
											<ScopeIcon class="h-4.5 w-4.5" />
										</div>
										<p class="mt-3 text-sm font-semibold">{option.label}</p>
										<p
											class={`mt-1 text-xs ${scopeType === option.value ? 'text-white/75' : 'text-on-surface-variant'}`}
										>
											{option.description}
										</p>
									</button>
								{/each}
							</div>
						</div>

						{#if scopeType === 'PRODUCT_CATEGORY'}
							<label class="block space-y-2">
								<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
									Categoría de productos
								</span>
								<select
									bind:value={scopeValue}
									class="w-full rounded-2xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface"
								>
									<option value="">Todos los productos</option>
									{#each ALL_PRODUCT_TYPES as type (type)}
										<option value={type}>{PRODUCT_TYPE_LABELS[type]}</option>
									{/each}
								</select>
								<p class="text-xs text-on-surface-variant">
									Deja “Todos los productos” para auditar la línea completa.
								</p>
							</label>
						{/if}

						<label class="block space-y-2">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Notas operativas
							</span>
							<textarea
								bind:value={notes}
								rows="5"
								class="w-full rounded-2xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface"
								placeholder="Observaciones opcionales para esta sesión"
							></textarea>
						</label>

						{#if formError}
							<div
								class="rounded-2xl border border-error/15 bg-error-container px-4 py-3 text-sm text-on-error-container"
							>
								{formError}
							</div>
						{/if}
					</div>

					<aside class="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Antes de iniciar
						</p>
						<h3 class="mt-1 text-lg font-semibold text-brand-navy">Checklist de una sesión sana</h3>
						<div class="mt-4 space-y-3 text-sm text-on-surface-variant">
							<div class="flex items-start gap-3">
								<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
								<p>Se toma un snapshot del stock actual como punto de referencia.</p>
							</div>
							<div class="flex items-start gap-3">
								<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
								<p>Solo puede existir una sesión activa a la vez.</p>
							</div>
							<div class="flex items-start gap-3">
								<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
								<p>Las diferencias quedan como informe; los ajustes se hacen manualmente.</p>
							</div>
							<div class="flex items-start gap-3">
								<CheckCircle2 class="mt-0.5 h-4 w-4 text-brand-blue" />
								<p>Cada línea deberá contarse o confirmarse explícitamente antes de cerrar.</p>
							</div>
						</div>

						<div
							class="mt-5 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-on-surface-variant"
						>
							<p class="font-medium text-brand-navy">Alcance seleccionado</p>
							<p class="mt-1">{getScopeLabel(scopeType)}</p>
						</div>
					</aside>
				</div>

				<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						disabled={isSubmitting}
						class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
					>
						Cancelar
					</button>
					<button
						type="button"
						onclick={handleCreateSession}
						disabled={isSubmitting}
						class="rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? 'Iniciando...' : 'Iniciar sesión'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
