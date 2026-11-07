<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getInventoryCountContext } from '$lib/context';
	import {
		applyAdjustmentsBatchCmd,
		applyLineAdjustmentCmd,
		applySessionCmd,
		cancelSessionCmd,
		confirmZeroStock,
		recountCountLineCmd,
		setSessionResponsibles,
		upsertCountLineCmd
	} from '$lib/remote/inventoryCount.remote';
	import { getErrorMessage } from '$lib/utils';
	import {
		ADJUSTMENT_REASON_LABELS,
		AdjustmentReason,
		ALL_ADJUSTMENT_REASONS
	} from '$lib/shared/enums';
	import {
		computeCountStats,
		lineDiff,
		formatUsd,
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
	import ReviewBoard from '$lib/components/inventory/count/ReviewBoard.svelte';
	import ReportBoard from '$lib/components/inventory/count/ReportBoard.svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import MultiCombobox from '$lib/components/inventory/count/ui/MultiCombobox.svelte';

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
	let phase = $state<1 | 2 | 3>(session.status === 'OPEN' ? 1 : 3);
	let isSubmitting = $state(false);
	let isMobileView = $state(false);
	let mobileMode = $state<'ficha' | 'lista'>('lista');

	// Ajuste de línea (drawer) y en lote
	let adjustTarget = $state<CountLineRow | null>(null);
	let adjustReason = $state<AdjustmentReason>(AdjustmentReason.PHYSICAL_COUNT);
	let adjustReasonText = $state('');
	let isAdjusting = $state(false);

	// Responsables (drawer) y cancelación (modal)
	let showResponsibles = $state(false);
	let pendingResponsibleTags = $state<Tag[]>([]);
	let cancelModal = $state(false);
	let cancelReason = $state('');

	const costByLineId = $derived(
		new Map<number, number | null>(
			Object.entries(initialCosts).map(([key, value]) => [Number(key), value ?? null])
		)
	);

	const stats = $derived(computeCountStats(lines, config, costByLineId));

	function canAdjustSummary(): 'in' | 'out' {
		if (!adjustTarget) return 'out';
		return (lineDiff(adjustTarget) ?? 0) > 0 ? 'in' : 'out';
	}

	const pendingTagVariants = $derived.by(() => {
		const map: Record<string, 'navy' | 'warning'> = {};
		for (const tag of pendingResponsibleTags) {
			map[tag.key] = userOptions.some((option) => option.userId === tag.key) ? 'navy' : 'warning';
		}
		return map;
	});

	const canCloseNow = $derived(
		lines.length > 0 && stats.pendingCounting === 0 && stats.recountsPending === 0
	);

	const ctaDisabledReason = $derived.by(() => {
		if (phase === 1) {
			return stats.pendingCounting > 0
				? `Faltan ${stats.pendingCounting} por contar|Cuando no queden pendientes pasas a revisar diferencias.`
				: null;
		}
		if (phase === 2) {
			return stats.recountsPending > 0
				? `Faltan ${stats.recountsPending} recuentos|Las diferencias sobre el umbral deben recontarse.`
				: null;
		}
		return null;
	});

	const ctaLabel = $derived(phase === 1 ? 'Revisar →' : 'Cerrar conteo');

	const diffRows = $derived.by(() => {
		return lines
			.map((line) => {
				const diff = lineDiff(line);
				return { line, diff };
			})
			.filter(
				(entry): entry is { line: CountLineRow; diff: number } =>
					entry.diff != null && entry.diff !== 0
			)
			.sort((a, b) => {
				const costA = costByLineId.get(a.line.id) ?? 0;
				const costB = costByLineId.get(b.line.id) ?? 0;
				return Math.abs(b.diff * costB) - Math.abs(a.diff * costA);
			});
	});

	const batchAdjustable = $derived(
		diffRows.filter(({ line, diff }) => {
			if (line.adjustmentMovementId != null) return false;
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

	async function saveLine(lineId: number, value: number): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await upsertCountLineCmd({ lineId, countedStock: value });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			lines = lines.map((candidate) =>
				candidate.id === response.data.id ? response.data : candidate
			);
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo guardar el conteo'));
		} finally {
			isSubmitting = false;
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

	async function applyAdjust(line: CountLineRow): Promise<void> {
		if (adjustReason === AdjustmentReason.OTHER && !adjustReasonText.trim()) {
			toast.error('Escribe el motivo');
			return;
		}
		if (isAdjusting) return;
		isAdjusting = true;
		try {
			const response = await applyLineAdjustmentCmd({
				lineId: line.id,
				reason: adjustReason,
				reasonText: adjustReason === AdjustmentReason.OTHER ? adjustReasonText.trim() : null
			});
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			lines = lines.map((candidate) =>
				candidate.id === response.data.id ? response.data : candidate
			);
			closeAdjust();
			toast.success(`Ajuste aplicado (${ADJUSTMENT_REASON_LABELS[adjustReason]})`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo aplicar el ajuste'));
		} finally {
			isAdjusting = false;
		}
	}

	async function applyBatch(): Promise<void> {
		if (adjustReason === AdjustmentReason.OTHER && !adjustReasonText.trim()) {
			toast.error('Escribe el motivo');
			return;
		}
		if (isAdjusting) return;
		isAdjusting = true;
		try {
			const response = await applyAdjustmentsBatchCmd({
				sessionId: session.id,
				reason: adjustReason,
				reasonText: adjustReason === AdjustmentReason.OTHER ? adjustReasonText.trim() : null
			});
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			await refreshLines();
			closeAdjust();
			toast.success(`${response.data} ajuste(s) aplicados`);
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudieron aplicar los ajustes'));
		} finally {
			isAdjusting = false;
		}
	}

	async function refreshLines(): Promise<void> {
		const detail = await import('$lib/server/db/queries/inventoryCount/sessions').then((module) =>
			module.getSessionById(session.id)
		);
		if (!detail) {
			toast.error('No se pudo recargar la sesión');
			return;
		}
		lines = detail.lines;
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

	async function doCancelSession(): Promise<void> {
		if (cancelReason.trim().length < 5) {
			toast.error('El motivo necesita al menos 5 caracteres');
			return;
		}
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const response = await cancelSessionCmd({ id: session.id, reason: cancelReason.trim() });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			session = response.data;
			lines = response.data.lines;
			responsibles = response.data.responsibles;
			phase = 3;
			countContext.activeSession = null;
			cancelModal = false;
			toast.success('Sesión cancelada');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo cancelar la sesión'));
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
		if (phase === 1 && canCloseInPhase1()) {
			phase = 2;
		} else if (phase === 2 && canCloseNow) {
			void applyNow();
		}
	}

	function canCloseInPhase1(): boolean {
		return phase === 1 && stats.pendingCounting === 0;
	}

	function onBack(): void {
		if (session.status === 'OPEN') {
			countContext.activeSession = { id: session.id };
		}
		void goto(resolve('/inventory/count'), { replaceState: true });
	}

	let userOptions = $state<Array<{ userId: string; displayName: string }>>(
		responsibles
			.filter((entry: ResponsibleRow) => entry.userId != null)
			.map((entry: ResponsibleRow) => ({
				userId: entry.userId as string,
				displayName: entry.displayName
			}))
	);

	async function loadResponsibleOptions(): Promise<void> {
		const { listCountResponsibles } = await import('$lib/remote/inventoryCount.remote');
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
			canCount={data.canCount && !isSubmitting}
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
			onApplyBatch={applyBatch}
			onRecount={recountLine}
			onOpenAdjust={openAdjust}
		/>
	{/if}

	<!-- Drawer: Ajustar stock (dentro de la sesión) -->
	<SlideOver open={adjustTarget != null} onclose={closeAdjust} size="md">
		{#snippet header({ onclose })}
			<div class="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
				<h2 class="font-heading text-lg font-semibold text-brand-navy">Ajustar stock</h2>
				<button
					type="button"
					aria-label="Cerrar"
					class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
					onclick={onclose}
				>
					✕
				</button>
			</div>
		{/snippet}

		{#if adjustTarget}
			<div class="space-y-3 px-4 py-4">
				<div>
					<b class="text-brand-navy">{adjustTarget.itemName}</b>
					<span class="block font-mono text-xs text-outline">{adjustTarget.itemCode ?? ''}</span>
				</div>
				{#if canAdjustSummary() === 'in'}
					<div
						class="rounded-lg bg-warning-container px-3 py-2.5 text-sm font-medium text-on-warning-container"
					>
						Entrada de {Math.abs(lineDiff(adjustTarget) ?? 0)} u · {formatUsd(
							(lineDiff(adjustTarget) ?? 0) * (costByLineId.get(adjustTarget.id) ?? 0)
						)}
					</div>
				{:else}
					<div
						class="rounded-lg bg-error-container px-3 py-2.5 text-sm font-medium text-on-error-container"
					>
						Salida de {Math.abs(lineDiff(adjustTarget) ?? 0)} u · {formatUsd(
							(lineDiff(adjustTarget) ?? 0) * (costByLineId.get(adjustTarget.id) ?? 0)
						)}
					</div>
				{/if}

				<label class="block">
					<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase"
						>Motivo</span
					>
					<select
						bind:value={adjustReason}
						class="mt-1 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm"
					>
						{#each ALL_ADJUSTMENT_REASONS as option (option)}
							<option value={option}>{ADJUSTMENT_REASON_LABELS[option]}</option>
						{/each}
					</select>
				</label>
				{#if adjustReason === AdjustmentReason.OTHER}
					<label class="block">
						<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase"
							>Descripción</span
						>
						<input
							type="text"
							bind:value={adjustReasonText}
							class="mt-1 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm"
							placeholder="Describe el motivo"
							aria-label="Texto del motivo"
						/>
					</label>
				{/if}
				<p class="text-xs text-on-surface-variant">
					Se vincula un movimiento de inventario a esta línea del conteo.
				</p>
			</div>
		{/if}

		{#snippet footer()}
			<div class="flex justify-end gap-2 border-t border-outline-variant/30 px-4 py-3">
				<button
					type="button"
					class="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
					onclick={closeAdjust}
				>
					Cancelar
				</button>
				<button
					type="button"
					aria-disabled={isAdjusting}
					class="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-gold-dark aria-disabled:opacity-60"
					onclick={() => adjustTarget && void applyAdjust(adjustTarget)}
				>
					Aplicar ajuste
				</button>
			</div>
		{/snippet}
	</SlideOver>

	<!-- Drawer: Responsables de la sesión -->
	<SlideOver bind:open={showResponsibles} onclose={() => (showResponsibles = false)} size="md">
		{#snippet header({ onclose })}
			<div class="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
				<h2 class="font-heading text-lg font-semibold text-brand-navy">Responsables del conteo</h2>
				<button
					type="button"
					aria-label="Cerrar"
					class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
					onclick={onclose}
				>
					✕
				</button>
			</div>
		{/snippet}

		<div class="space-y-3 px-4 py-4">
			<MultiCombobox
				options={userOptions.map((option) => ({ id: option.userId, name: option.displayName }))}
				value={pendingResponsibleTags}
				placeholder="Buscar usuario o escribir un nombre…"
				createLabel="como persona externa"
				tagVariants={pendingTagVariants}
				onchange={(tags) => {
					pendingResponsibleTags = tags;
				}}
				oncreate={(name) => pendingResponsibleTags.push({ key: name, label: name })}
			/>
			<p class="text-sm text-on-surface-variant">
				Los usuarios activos pueden ver e interactuar con el conteo (ADMIN/MANAGER siempre). Las
				personas externas solo se registran en el informe. Quitar a alguien no borra lo que ya
				contó.
			</p>
		</div>

		{#snippet footer()}
			<div class="flex justify-end border-t border-outline-variant/30 px-4 py-3">
				<button
					type="button"
					aria-disabled={isSubmitting}
					class="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark aria-disabled:opacity-60"
					onclick={() => void saveResponsibles()}
				>
					Listo
				</button>
			</div>
		{/snippet}
	</SlideOver>

	<!-- Modal: Cancelar sesión -->
	<ConfirmModal
		bind:open={cancelModal}
		title="Cancelar conteo"
		confirmLabel="Confirmar cancelación"
		confirmColor="red"
		onConfirm={() => void doCancelSession()}
	>
		{#snippet body()}
			<p class="text-sm text-on-surface-variant">
				La sesión queda en solo lectura y no se aplica ningún ajuste.
			</p>
			<label class="mt-3 block space-y-1">
				<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					Motivo (mín. 5 caracteres)
				</span>
				<textarea
					bind:value={cancelReason}
					rows="3"
					class="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm"
					placeholder="Indica por qué se cancela el conteo"></textarea>
			</label>
		{/snippet}
	</ConfirmModal>
</div>
