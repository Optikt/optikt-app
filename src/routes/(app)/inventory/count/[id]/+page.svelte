<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getInventoryCountContext } from '$lib/context';
	import {
		applySessionCmd,
		confirmZeroStock,
		recountCountLineCmd,
		setSessionResponsibles,
		upsertCountLineCmd,
		getDiffCosts,
		getSessionById,
		listCountResponsibles
	} from '$lib/remote/inventoryCount.remote';
	import { getErrorMessage } from '$lib/utils';
	import { logger } from '$lib/utils/logger';
	import { createLineSaveQueue } from '$lib/shared/countLineSaveQueue';
	import {
		blockedToast,
		buildDiffRows,
		phaseCtaAction,
		phaseCtaLabel,
		phaseCtaReason,
		stepClickOutcome
	} from '$lib/shared/countSessionPhase';
	import { AdjustmentReason } from '$lib/shared/enums';
	import {
		computeCountStats,
		lineNeedsAdjustment,
		lineNeedsCost,
		type CountCycleConfig
	} from '$lib/shared/inventoryCount';
	import type {
		InventoryCountSessionDetail,
		CountLineRow,
		ResponsibleRow
	} from '$lib/server/db/queries/inventoryCount/types';
	import SessionHeaderBar from '$lib/components/inventory/count/SessionHeaderBar.svelte';
	import SummaryStrip from '$lib/components/inventory/count/SummaryStrip.svelte';
	import CountBoard from '$lib/components/inventory/count/CountBoard.svelte';
	import AdjustStockDrawer from '$lib/components/inventory/count/AdjustStockDrawer.svelte';
	import { createAdjustmentActions } from '$lib/components/inventory/count/adjustmentActions';
	import CancelCountModal from '$lib/components/inventory/count/CancelCountModal.svelte';
	import ResponsiblesDrawer from '$lib/components/inventory/count/ResponsiblesDrawer.svelte';

	import ReviewBoard from '$lib/components/inventory/count/ReviewBoard.svelte';
	import ReportBoard from '$lib/components/inventory/count/ReportBoard.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	interface Tag {
		key: string;
		label: string;
	}

	let { data } = $props();

	// Datos iniciales solo vía `load`; todo lo demás son updates por remote.
	const initialSession = untrack(() => data.session) as InventoryCountSessionDetail;
	const initialConfig = untrack(() => data.config) as CountCycleConfig;
	const initialCosts = untrack(() => data.costs) as Record<string, number | null>;

	const countContext = getInventoryCountContext();
	const canManage = $derived(data.canManage as boolean);

	let session = $state<InventoryCountSessionDetail>(initialSession);
	let lines = $state<CountLineRow[]>(initialSession.lines);
	let responsibles = $state(initialSession.responsibles);
	let config = $state<CountCycleConfig>(initialConfig);
	let phase = $state<1 | 2 | 3>(untrack((): 1 | 2 | 3 => (session.status === 'OPEN' ? 1 : 3)));
	let isSubmitting = $state(false);
	let isMobileView = $state(false);
	let mobileMode = $state<'ficha' | 'lista'>('lista');
	// Costos FIFO por línea (claves string, como los devuelve getDiffCosts).
	let costsByLine = $state<Record<string, number | null>>(initialCosts);

	// Ajuste de línea (drawer) y en lote
	let adjustTarget = $state<CountLineRow | null>(null);
	let adjustReason = $state<AdjustmentReason>(AdjustmentReason.PHYSICAL_COUNT);
	let adjustReasonText = $state('');
	let isAdjusting = $state(false);

	// Responsables (drawer) y cancelación (modal)
	let showResponsibles = $state(false);
	let pendingResponsibleTags = $state<Tag[]>([]);
	let cancelModal = $state(false);
	// Confirmación de cierre cuando hay diferencias sin ajustar.
	let closeConfirm = $state(false);

	const costByLineId = $derived(
		new Map<number, number | null>(
			Object.entries(costsByLine).map(([key, value]) => [Number(key), value ?? null])
		)
	);

	const stats = $derived(computeCountStats(lines, config, costByLineId));

	const canCloseNow = $derived(
		lines.length > 0 && stats.pendingCounting === 0 && stats.recountsPending === 0
	);

	const ctaDisabledReason = $derived(phaseCtaReason(phase, stats));
	const ctaLabel = $derived(phaseCtaLabel(phase));

	const diffRows = $derived(buildDiffRows(lines, costByLineId));
	const unadjustedCount = $derived(lines.filter(lineNeedsAdjustment).length);

	const batchAdjustable = $derived(
		diffRows.filter(({ line, diff }) => {
			if (line.adjustmentMovementId != null) return false;
			if (line.adjustmentRequestedAt != null) return false;
			const cost = costByLineId.get(line.id) ?? 0;
			const usdHit =
				config.diffThresholdUsd > 0 && Math.abs(diff * cost) >= config.diffThresholdUsd;
			return Math.abs(diff) < config.diffThresholdUnits && !usdHit;
		})
	);

	// ── Eventos/UI helpers ────────────────────────────────────────────────────

	function handleKeydown(event: KeyboardEvent): void {
		// Atajo «/» para enfocar la búsqueda de la hoja (solo fase Contar).
		if (event.key === '/' && phase === 1) {
			const target = event.target as HTMLElement | null;
			if (!target || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
			const input = document.querySelector<HTMLInputElement>('[data-count-search]');
			if (input) {
				event.preventDefault();
				input.focus();
			}
		}
	}

	// Guard por línea (cola «último valor gana»): dos líneas se guardan en
	// paralelo y las ediciones mientras una vuela no se descartan.
	// El Set es reactivo ($state): la cola lo muta con add/delete.
	const savingLineIds = $state<Set<number>>(new Set());
	const lineSaves = createLineSaveQueue({
		inFlight: savingLineIds,
		send: async (lineId, value) => {
			const response = await upsertCountLineCmd({ lineId, countedStock: value });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			lines = lines.map((candidate) =>
				candidate.id === response.data.id ? response.data : candidate
			);
			if (lineNeedsCost(response.data, costsByLine)) void refreshCosts();
		}
	});

	async function saveLine(lineId: number, value: number): Promise<void> {
		try {
			await lineSaves.submit(lineId, value);
		} catch (error) {
			logger.error('No se pudo guardar el conteo', error);
			toast.error(getErrorMessage(error, 'No se pudo guardar el conteo'));
		}
	}

	async function confirmZero(): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await confirmZeroStock({ sessionId: session.id });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			toast.success(`Stock 0 confirmado en lote (${response.data} ítems)`);
			await refreshLines();
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo confirmar el stock 0'));
		} finally {
			isSubmitting = false;
		}
	}

	async function recountLine(line: CountLineRow, raw: string): Promise<void> {
		const value = raw.trim();
		if (!value) return;
		const numeric = Number.parseInt(value, 10);
		if (Number.isNaN(numeric) || numeric < 0) {
			toast.error('El recuento debe ser un entero ≥ 0');
			return;
		}
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await recountCountLineCmd({ lineId: line.id, recountedStock: numeric });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			lines = lines.map((candidate) =>
				candidate.id === response.data.id ? response.data : candidate
			);
			if (lineNeedsCost(response.data, costsByLine)) void refreshCosts();
			toast.success('Recuento guardado');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo guardar el recuento'));
		} finally {
			isSubmitting = false;
		}
	}

	function openAdjust(line: CountLineRow): void {
		adjustTarget = line;
		adjustReason = AdjustmentReason.PHYSICAL_COUNT;
		adjustReasonText = '';
	}

	function closeAdjust(): void {
		adjustTarget = null;
		adjustReasonText = '';
	}

	// Acciones de ajuste (solicitar/lote/quitar) fuera de la página: size gate DT1.
	const { requestAdjust, requestBatch, clearAdjust } = createAdjustmentActions({
		// El id de sesión es constante en esta página (no cambia con refetch).
		sessionId: untrack(() => session.id),
		getReason: () => ({ reason: adjustReason, reasonText: adjustReasonText }),
		replaceLine: (line) => {
			lines = lines.map((candidate) => (candidate.id === line.id ? line : candidate));
		},
		refreshLines,
		closeDrawer: closeAdjust,
		isBusy: () => isAdjusting,
		setBusy: (busy) => {
			isAdjusting = busy;
		}
	});

	async function refreshLines(): Promise<void> {
		const detail = await getSessionById({ id: session.id });
		if (!detail) {
			toast.error('No se pudo recargar la sesión');
			return;
		}
		lines = detail.lines;
		if (detail.lines.some((line) => lineNeedsCost(line, costsByLine))) void refreshCosts();
	}

	// Costos FIFO: el mapa del load solo cubre las líneas ya contadas al cargar;
	// al aparecer una diferencia nueva se piden al server. La cola evita
	// apilarse si varias líneas se guardan juntas.
	let costsRefreshing = false;
	let costsQueued = false;
	async function refreshCosts(): Promise<void> {
		if (!canManage) return;
		if (costsRefreshing) {
			costsQueued = true;
			return;
		}
		costsRefreshing = true;
		try {
			do {
				costsQueued = false;
				costsByLine = await getDiffCosts({ sessionId: session.id });
			} while (costsQueued);
		} catch (error) {
			logger.error('No se pudieron actualizar los costos del conteo', error);
		} finally {
			costsRefreshing = false;
		}
	}

	// Responsables: sincronización (solo A/M).
	function openResponsibles(): void {
		pendingResponsibleTags = responsibles.map((entry: ResponsibleRow) => ({
			key: entry.userId ?? entry.displayName,
			label: entry.displayName
		}));
		showResponsibles = true;
		void loadResponsibleOptions();
	}

	async function saveResponsibles(): Promise<void> {
		const entries = pendingResponsibleTags.map((tag) => ({
			userId: userOptions.some((option) => option.userId === tag.key) ? tag.key : undefined,
			displayName: tag.label,
			isExternal: !userOptions.some((option) => option.userId === tag.key)
		}));
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await setSessionResponsibles({ sessionId: session.id, entries });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			responsibles = response.data;
			showResponsibles = false;
			toast.success('Responsables actualizados');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo actualizar responsables'));
		} finally {
			isSubmitting = false;
		}
	}

	async function applyNow(): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await applySessionCmd({ id: session.id });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			session = response.data;
			lines = response.data.lines;
			responsibles = response.data.responsibles;
			// El cierre ejecuta ajustes que mueven lotes: refresca costos antes del informe.
			await refreshCosts();
			phase = 3;
			countContext.activeSession = null;
			toast.success('Conteo cerrado');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo cerrar la sesión'));
		} finally {
			isSubmitting = false;
		}
	}

	function handlePhaseCta(): void {
		const action = phaseCtaAction(phase, stats, canCloseNow);
		if (action === 'back') onBack();
		else if (action === 'review') phase = 2;
		else if (action === 'close') {
			// Cerrar con diferencias sin ajustar exige confirmación explícita.
			if (unadjustedCount > 0) {
				closeConfirm = true;
				return;
			}
			void applyNow();
		} else notifyCtaBlocked();
	}

	/** Toast con el motivo de bloqueo del CTA (Título|Cuerpo). */
	function notifyCtaBlocked(): void {
		const { title, description } = blockedToast(ctaDisabledReason);
		toast.info(title, { description });
	}

	/** Clic en un paso del stepper: navega entre fases; nunca cierra la sesión. */
	function handleStepClick(step: 1 | 2 | 3): void {
		const outcome = stepClickOutcome(step, phase, ctaDisabledReason);
		if (outcome.kind === 'blocked') notifyCtaBlocked();
		else if (outcome.kind === 'phase') phase = outcome.phase;
	}

	function onBack(): void {
		if (session.status === 'OPEN') {
			countContext.activeSession = { id: session.id };
		}
		void goto(resolve('/inventory/count'), { replaceState: true });
	}

	let userOptions = $state<Array<{ userId: string; displayName: string }>>(
		untrack(() =>
			responsibles
				.filter((entry: ResponsibleRow) => entry.userId != null)
				.map((entry: ResponsibleRow) => ({
					userId: entry.userId as string,
					displayName: entry.displayName
				}))
		)
	);

	async function loadResponsibleOptions(): Promise<void> {
		const response = await listCountResponsibles();
		userOptions = response;
	}
</script>

<svelte:head>
	<title>Conteo #{session.id} · Conteo físico · Optikt</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="min-0 flex h-full flex-col bg-[#edf1f6]">
	<SessionHeaderBar
		title={session.status === 'OPEN' ? `Conteo #${session.id}` : `Informe #${session.id}`}
		scope={session.scopeLabel}
		{phase}
		progress={{ verified: stats.verified, total: stats.total }}
		{responsibles}
		{canManage}
		{ctaLabel}
		ctaDisabledReason={session.status === 'OPEN' ? ctaDisabledReason : null}
		{onBack}
		onOpenPhase={handlePhaseCta}
		onCtaBlocked={notifyCtaBlocked}
		onStepClick={handleStepClick}
		onOpenResponsibles={openResponsibles}
		onCancel={() => (cancelModal = true)}
	/>

	{#if phase !== 3}
		<SummaryStrip {stats} />
	{/if}

	{#if session.status !== 'OPEN'}
		<ReportBoard {session} {lines} {costByLineId} {stats} {responsibles} />
	{:else if phase === 1}
		{#if isMobileView}
			<div class="flex justify-center py-2">
				<button
					type="button"
					aria-pressed={mobileMode === 'ficha'}
					class="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-navy shadow-sm"
					onclick={() => (mobileMode = mobileMode === 'ficha' ? 'lista' : 'ficha')}
				>
					{mobileMode === 'ficha' ? 'Ficha | Lista' : 'Lista | Ficha'} (alternar)
				</button>
			</div>
		{/if}
		<CountBoard
			{lines}
			{config}
			{costByLineId}
			canCount={data.canCount}
			{savingLineIds}
			onSaveLine={saveLine}
			onConfirmZero={confirmZero}
			isMobile={isMobileView}
			mode={mobileMode}
		/>
	{:else if phase === 2}
		<ReviewBoard
			rows={diffRows}
			{config}
			{costByLineId}
			canReview={canManage}
			isBusy={isSubmitting}
			batchCount={batchAdjustable.length}
			bind:reason={adjustReason}
			bind:reasonText={adjustReasonText}
			onRequestBatch={requestBatch}
			onRecount={recountLine}
			onOpenAdjust={openAdjust}
			onClearAdjust={clearAdjust}
		/>
	{/if}

	<AdjustStockDrawer
		target={adjustTarget}
		unitCost={costByLineId.get(adjustTarget?.id ?? -1) ?? null}
		isBusy={isAdjusting}
		bind:reason={adjustReason}
		bind:reasonText={adjustReasonText}
		onclose={closeAdjust}
		onApply={(line) => void requestAdjust(line)}
	/>

	<ResponsiblesDrawer
		bind:open={showResponsibles}
		{userOptions}
		bind:pendingResponsibleTags
		isBusy={isSubmitting}
		onClose={() => (showResponsibles = false)}
		onSave={() => void saveResponsibles()}
	/>

	<!-- Modal: Cancelar sesión -->
	<CancelCountModal
		bind:open={cancelModal}
		sessionId={session.id}
		onCancelled={(detail) => {
			session = detail;
			lines = detail.lines;
			responsibles = detail.responsibles;
			phase = 3;
			countContext.activeSession = null;
		}}
	/>

	<!-- Modal: cerrar con diferencias sin ajustar -->
	<ConfirmModal
		bind:open={closeConfirm}
		title="Cerrar con diferencias sin ajustar"
		message={`${unadjustedCount} línea(s) con diferencia no tienen ajuste solicitado: al cerrar no se creará ningún movimiento de stock para ellas (quedarán como «Ajuste pendiente» en el informe). Si no quieres ajustarlas, continúa.`}
		confirmLabel="Cerrar de todos modos"
		confirmColor="yellow"
		onConfirm={() => {
			closeConfirm = false;
			void applyNow();
		}}
	/>
</div>
