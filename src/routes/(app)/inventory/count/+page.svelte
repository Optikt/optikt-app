<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { getInventoryCountContext } from '$lib/context';
	import {
		createSession,
		getSessions as getSessionsQuery
	} from '$lib/remote/inventoryCount.remote';
	import type { InventoryCountScopeType } from '$lib/schemas/inventoryCount';
	import type { ProductType } from '$lib/shared/enums';
	import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';
	import { getErrorMessage } from '$lib/utils';
	import CountListHeader from '$lib/components/inventory/count/CountListHeader.svelte';
	import CountListMetrics from '$lib/components/inventory/count/CountListMetrics.svelte';
	import CountHistoryTable from '$lib/components/inventory/count/CountHistoryTable.svelte';
	import CountCreateModal from '$lib/components/inventory/count/CountCreateModal.svelte';
	import { isWithinLastDays, mergeCreatedSession } from '$lib/components/inventory/count/countList';

	let { data } = $props();
	const inventoryCountContext = getInventoryCountContext();
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

			const nextSummarySessions = mergeCreatedSession(summarySessions, result.session);
			summarySessions = nextSummarySessions;
			if (!historyScopeFilter && !historyOpenedOn) {
				historySessions = nextSummarySessions;
			}
			activeSession = result.session;
			inventoryCountContext.activeSession = { id: result.session.id };
			showCreateModal = false;
			await goto(resolve(`/inventory/count/${result.session.id}`));
		} catch (error) {
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
			});

			if (requestId !== historyRequestId) {
				return;
			}

			historySessions = nextSessions;
		} catch (error) {
			if (requestId !== historyRequestId) {
				return;
			}

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
	<CountListHeader
		{recentlyAppliedCount}
		{totalAuditedItems}
		{activeSession}
		onContinue={() => activeSession && goToSession(activeSession.id)}
		onCreate={openCreateModal}
	/>

	<CountListMetrics
		{totalSessions}
		{openSessionsCount}
		{recentlyAppliedCount}
		{totalAuditedItems}
		hasActiveSession={!!activeSession}
	/>

	<CountHistoryTable
		sessions={historySessions}
		{isHistoryLoading}
		{historyResultCount}
		emptyTitle={historyEmptyTitle}
		emptySubtitle={historyEmptySubtitle}
		bind:historyScopeFilter
		bind:historyOpenedOn
		{hasHistoryFilters}
		onToggleScope={toggleHistoryScopeFilter}
		onDayChange={applyHistoryDayFilter}
		onClear={clearHistoryFilters}
		onOpenSession={goToSession}
	/>

	<CountCreateModal
		bind:showCreate={showCreateModal}
		{isSubmitting}
		bind:scopeType
		bind:scopeValue
		bind:notes
		{formError}
		onSelectScope={selectScope}
		onClose={() => (showCreateModal = false)}
		onSubmit={handleCreateSession}
		onKeydown={handleModalKeydown}
	/>
</div>
