<script lang="ts">
	import { Check, Search, X, TriangleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { AppBadge, DataGrid, PageHeader } from '$lib/components/ui';
	import {
		applySession,
		cancelSession,
		setLineAdjustmentStatus,
		upsertCountLine
	} from '$lib/remote/inventoryCount.remote';
	import {
		canCloseInventoryCountSession,
		getInventoryCountStatusLabel,
		INVENTORY_COUNT_UI_FILTER_LABELS,
		type InventoryCountUiFilter
	} from '$lib/schemas/inventoryCount';
	import { isAdminRole } from '$lib/shared/enums';
	import type {
		InventoryCountLineRow,
		InventoryCountSessionDetail
	} from '$lib/server/db/queries/inventoryCount';
	import { formatDate, getErrorMessage } from '$lib/utils';

	let { data } = $props();
	let session = $state<InventoryCountSessionDetail>(untrack(() => data.session));
	let lines = $state<InventoryCountLineRow[]>(untrack(() => data.session.lines));
	let search = $state('');
	let activeFilter = $state<InventoryCountUiFilter>('ALL');
	let showApplyModal = $state(false);
	let showCancelModal = $state(false);
	let cancelReason = $state('');
	let isApplying = $state(false);
	let isCancelling = $state(false);
	let updatingAdjustmentLineIds = $state<number[]>([]);
	let editing = $state({
		lineId: null as number | null,
		count: '',
		notes: '',
		showNotes: false,
		isSaving: false
	});

	const currentUser = $derived(data.user);
	const canManage = $derived(isAdminRole(currentUser.role));
	const isReadonly = $derived(session.status !== 'OPEN');
	const totalLines = $derived(lines.length);
	const countedLines = $derived(lines.filter((line) => line.countedStock !== null));
	const countedTotal = $derived(countedLines.length);
	const pendingTotal = $derived(totalLines - countedTotal);
	const positiveDiffLines = $derived(countedLines.filter((line) => (line.difference ?? 0) > 0));
	const negativeDiffLines = $derived(countedLines.filter((line) => (line.difference ?? 0) < 0));
	const diffLines = $derived(countedLines.filter((line) => (line.difference ?? 0) !== 0));
	const matchedLines = $derived(countedLines.filter((line) => (line.difference ?? 0) === 0));
	const completedManualAdjustments = $derived(
		diffLines.filter((line) => line.adjustmentCompleted).length
	);
	const pendingManualAdjustments = $derived(diffLines.length - completedManualAdjustments);
	const positiveUnits = $derived(
		positiveDiffLines.reduce((sum, line) => sum + Math.max(line.difference ?? 0, 0), 0)
	);
	const negativeUnits = $derived(
		negativeDiffLines.reduce((sum, line) => sum + Math.abs(Math.min(line.difference ?? 0, 0)), 0)
	);
	const progressPercent = $derived(
		totalLines === 0 ? 0 : Math.round((countedTotal / totalLines) * 100)
	);
	const scopeLabel = $derived(
		session.scopeType === 'PRODUCT_CATEGORY'
			? `Solo productos${session.scopeValue ? ` - ${session.scopeValue}` : ''}`
			: session.scopeType === 'LENS'
				? 'Solo lentes STOCK'
				: 'Todo el inventario'
	);
	const statusLabel = $derived(getInventoryCountStatusLabel(session.status));
	const varianceUnits = $derived(positiveUnits - negativeUnits);
	const varianceUnitsLabel = $derived(
		varianceUnits === 0
			? 'Sin variación neta'
			: varianceUnits > 0
				? `+${varianceUnits}`
				: `${varianceUnits}`
	);
	const openedSummary = $derived(
		`Apertura: ${formatDate(session.openedAt, { dateStyle: 'medium', timeStyle: 'short' })} · Responsable: ${session.openedByName ?? 'Usuario'}`
	);
	const lifecycleSummary = $derived.by(() => {
		if (session.status === 'APPLIED' && session.appliedAt) {
			return `Cerró: ${session.appliedByName ?? 'Usuario'} · ${formatDate(session.appliedAt, {
				dateStyle: 'medium',
				timeStyle: 'short'
			})}`;
		}

		if (session.status === 'CANCELLED') {
			const reason = session.cancelReason?.trim();
			return `Canceló: ${session.cancelledByName ?? 'Usuario'}${reason ? ` · ${reason}` : ''}`;
		}

		return null;
	});
	const hasSessionNotes = $derived(Boolean(session.notes?.trim()));
	const canCloseSession = $derived(canCloseInventoryCountSession(totalLines, countedTotal));
	const normalizedSearch = $derived(search.trim().toLowerCase());
	const filteredLines = $derived(
		lines.filter((line) => {
			const matchesFilter =
				activeFilter === 'ALL'
					? true
					: activeFilter === 'PENDING'
						? line.countedStock === null
						: activeFilter === 'WITH_DIFF'
							? line.countedStock !== null && (line.difference ?? 0) !== 0
							: line.countedStock !== null && (line.difference ?? 0) === 0;

			if (!matchesFilter) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			const haystack = [line.itemName, line.itemCode, line.itemDetail]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			return haystack.includes(normalizedSearch);
		})
	);

	type CompactStatTone = 'neutral' | 'success' | 'warning' | 'error';
	type CompactStat = {
		id: string;
		label: string;
		value: string;
		tone: CompactStatTone;
	};

	const compactStats = $derived.by<CompactStat[]>(() => {
		const stats: CompactStat[] = [
			{
				id: 'pending',
				label: 'Pendientes',
				value: String(pendingTotal),
				tone: pendingTotal > 0 ? 'warning' : 'neutral'
			},
			{
				id: 'matched',
				label: 'OK',
				value: String(matchedLines.length),
				tone: matchedLines.length > 0 ? 'success' : 'neutral'
			},
			{
				id: 'positive',
				label: '+Dif',
				value: `${positiveDiffLines.length}/+${positiveUnits}`,
				tone: positiveDiffLines.length > 0 ? 'success' : 'neutral'
			},
			{
				id: 'negative',
				label: '-Dif',
				value: `${negativeDiffLines.length}/-${negativeUnits}`,
				tone: negativeDiffLines.length > 0 ? 'error' : 'neutral'
			},
			{
				id: 'variance',
				label: 'Var',
				value: varianceUnitsLabel,
				tone: varianceUnits > 0 ? 'success' : varianceUnits < 0 ? 'error' : 'neutral'
			}
		];

		if (diffLines.length > 0 || completedManualAdjustments > 0) {
			stats.push({
				id: 'adjustments',
				label: 'Ajustes',
				value: `${completedManualAdjustments}/${diffLines.length}`,
				tone: pendingManualAdjustments > 0 ? 'warning' : 'success'
			});
		}

		return stats;
	});

	const columns = [
		{ key: 'item', label: 'Ítem' },
		{ key: 'ref', label: 'SKU / Ref' },
		{ key: 'system', label: 'Stock sistema', align: 'right' as const },
		{ key: 'counted', label: 'Stock contado', align: 'right' as const },
		{ key: 'difference', label: 'Diferencia', align: 'right' as const },
		{ key: 'counter', label: 'Contado por' },
		{ key: 'action', label: 'Acción', align: 'right' as const }
	];

	type AdjustmentPath = `/products/${string}/adjustments` | `/lenses/${string}/adjustments`;

	function statusVariant(status: string) {
		if (status === 'OPEN') return 'warning';
		if (status === 'APPLIED') return 'success';
		return 'neutral';
	}

	function compactStatClass(tone: CompactStatTone) {
		if (tone === 'success') return 'text-success';
		if (tone === 'warning') return 'text-brand-gold';
		if (tone === 'error') return 'text-error';
		return 'text-brand-navy';
	}

	function differenceBadgeClass(difference: number | null) {
		if (difference === null) return 'bg-surface-container text-on-surface-variant';
		if (difference === 0) return 'bg-surface-container text-on-surface-variant';
		return difference > 0
			? 'bg-success-container/70 text-success'
			: 'bg-error-container/80 text-error';
	}

	function formatDifference(difference: number | null) {
		if (difference === null || difference === 0) return '—';
		return difference > 0 ? `+${difference}` : `${difference}`;
	}

	function hasDifference(line: InventoryCountLineRow) {
		return line.countedStock !== null && (line.difference ?? 0) !== 0;
	}

	function isMatchedLine(line: InventoryCountLineRow) {
		return line.countedStock !== null && (line.difference ?? 0) === 0;
	}

	function getAdjustmentPath(line: InventoryCountLineRow): AdjustmentPath | null {
		if (!hasDifference(line)) {
			return null;
		}

		if (line.itemType === 'PRODUCT' && line.productId) {
			return `/products/${line.productId}/adjustments`;
		}

		if (line.itemType === 'LENS' && line.lensCatalogItemId) {
			return `/lenses/${line.lensCatalogItemId}/adjustments`;
		}

		return null;
	}

	function goBack() {
		goto(resolve('/inventory/count'));
	}

	function openAdjustment(line: InventoryCountLineRow) {
		const adjustmentPath = getAdjustmentPath(line);
		if (!adjustmentPath) {
			return;
		}

		window.open(resolve(adjustmentPath), '_blank', 'noopener,noreferrer');
	}

	function isAdjustmentStatusUpdating(lineId: number) {
		return updatingAdjustmentLineIds.includes(lineId);
	}

	async function toggleAdjustmentCompleted(
		line: InventoryCountLineRow,
		adjustmentCompleted: boolean
	) {
		if (isAdjustmentStatusUpdating(line.id)) {
			return;
		}

		updatingAdjustmentLineIds = [...updatingAdjustmentLineIds, line.id];

		try {
			const result = await setLineAdjustmentStatus({ lineId: line.id, adjustmentCompleted });

			if (!result.success) {
				throw new Error(result.error ?? 'No se pudo actualizar el seguimiento del ajuste');
			}

			updateLineLocally(result.line);
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'No se pudo actualizar el tracking del ajuste'));
		} finally {
			updatingAdjustmentLineIds = updatingAdjustmentLineIds.filter(
				(candidateId) => candidateId !== line.id
			);
		}
	}

	function handleAdjustmentCheckboxChange(line: InventoryCountLineRow, event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}

		void toggleAdjustmentCompleted(line, target.checked);
	}

	function startEditing(line: InventoryCountLineRow) {
		if (isReadonly) {
			return;
		}

		editing = {
			lineId: line.id,
			count: line.countedStock !== null ? String(line.countedStock) : '',
			notes: line.notes ?? '',
			showNotes: Boolean(line.notes),
			isSaving: false
		};
	}

	function stopEditing() {
		editing = {
			lineId: null,
			count: '',
			notes: '',
			showNotes: false,
			isSaving: false
		};
	}

	function isEditing(lineId: number) {
		return editing.lineId === lineId;
	}

	function updateLineLocally(nextLine: InventoryCountLineRow) {
		lines = lines.map((line) => (line.id === nextLine.id ? nextLine : line));
		session = { ...session, lines };
	}

	async function handleSaveLine(line: InventoryCountLineRow) {
		const nextCount = Number(editing.count);
		if (!Number.isInteger(nextCount) || nextCount < 0) {
			toast.error('La cantidad contada debe ser un entero mayor o igual a 0');
			return;
		}

		const optimisticLine: InventoryCountLineRow = {
			...line,
			countedStock: nextCount,
			difference: nextCount - line.systemStock,
			adjustmentCompleted:
				line.adjustmentCompleted && line.countedStock === nextCount
					? line.adjustmentCompleted
					: false,
			adjustmentCompletedById:
				line.adjustmentCompleted && line.countedStock === nextCount
					? line.adjustmentCompletedById
					: null,
			adjustmentCompletedAt:
				line.adjustmentCompleted && line.countedStock === nextCount
					? line.adjustmentCompletedAt
					: null,
			adjustmentCompletedByName:
				line.adjustmentCompleted && line.countedStock === nextCount
					? line.adjustmentCompletedByName
					: null,
			countedById: currentUser.id,
			countedByName: currentUser.fullName,
			countedAt: new Date().toISOString(),
			notes: editing.notes.trim() || null
		};

		const previousLines = lines;
		editing.isSaving = true;
		updateLineLocally(optimisticLine);

		try {
			const result = await upsertCountLine({
				sessionId: session.id,
				itemId: line.itemId,
				itemType: line.itemType as 'PRODUCT' | 'LENS',
				countedStock: nextCount,
				notes: editing.notes.trim() || null
			});

			if (!result.success) {
				throw new Error(result.error ?? 'No se pudo guardar el conteo');
			}

			updateLineLocally(result.line);
			stopEditing();
		} catch (error) {
			console.error(error);
			lines = previousLines;
			session = { ...session, lines: previousLines };
			toast.error(getErrorMessage(error, 'No se pudo guardar el conteo'));
			editing.isSaving = false;
		}
	}

	async function handleApplySession() {
		if (isApplying) {
			return;
		}

		if (!canCloseSession) {
			toast.error('Debes contar o confirmar todos los ítems antes de cerrar la sesión');
			return;
		}

		isApplying = true;

		try {
			const result = await applySession({ id: session.id });

			if (!result.success) {
				throw new Error(result.error ?? 'No se pudo aplicar la sesión');
			}

			session = result.session;
			lines = result.session.lines;
			showApplyModal = false;
			stopEditing();
			toast.success('Sesión de conteo cerrada');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'No se pudo cerrar la sesión'));
		} finally {
			isApplying = false;
		}
	}

	async function handleCancelSession() {
		if (isCancelling) {
			return;
		}

		const reason = cancelReason.trim();
		if (reason.length < 5) {
			toast.error('Indica el motivo de cancelación');
			return;
		}

		isCancelling = true;

		try {
			const result = await cancelSession({ id: session.id, reason });

			if (!result.success) {
				throw new Error(result.error ?? 'No se pudo cancelar la sesión');
			}

			session = result.session;
			lines = result.session.lines;
			showCancelModal = false;
			cancelReason = '';
			stopEditing();
			toast.success('Sesión cancelada');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'No se pudo cancelar la sesión'));
		} finally {
			isCancelling = false;
		}
	}
</script>

<svelte:head>
	<title>Sesión #{session.id} - Conteo Físico - Optikt</title>
</svelte:head>

<div class="space-y-6 p-4 sm:p-6">
	<PageHeader
		title={`Sesión #${session.id}`}
		subtitle={session.status === 'OPEN'
			? 'Conteo físico en ejecución'
			: session.status === 'APPLIED'
				? 'Informe de conteo físico'
				: 'Conteo físico cancelado'}
		backLabel="Volver al historial"
		backOnClick={goBack}
	>
		{#snippet actions()}
			{#if session.status === 'OPEN' && canManage}
				<button
					type="button"
					onclick={() => (showApplyModal = true)}
					disabled={!canCloseSession}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Check class="h-4 w-4" />
					Cerrar sesión
				</button>
				<button
					type="button"
					onclick={() => (showCancelModal = true)}
					class="inline-flex items-center gap-2 rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
				>
					<X class="h-4 w-4" />
					Cancelar sesión
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<section class="space-y-3 border-b border-outline-variant/15 pb-3">
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

		<div
			class="flex flex-col gap-1 text-sm text-on-surface-variant lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3"
		>
			<p>{openedSummary}</p>
			{#if lifecycleSummary}
				<span class="hidden text-outline lg:inline">·</span>
				<p class="max-w-full truncate" title={lifecycleSummary}>{lifecycleSummary}</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
			{#each compactStats as stat, index (stat.id)}
				{#if index > 0}
					<span class="text-outline">·</span>
				{/if}
				<span class="text-on-surface-variant">
					{stat.label}:
					<span class={`font-semibold ${compactStatClass(stat.tone)}`}>{stat.value}</span>
				</span>
			{/each}
		</div>

		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
				<div
					class="h-full rounded-full bg-brand-blue transition-all duration-200"
					style={`width: ${progressPercent}%`}
				></div>
			</div>
			<p class="text-sm font-medium text-brand-navy">
				{countedTotal} / {totalLines} líneas · {progressPercent}%
			</p>
		</div>
	</section>

	<section class="glass-card border border-outline-variant/20 bg-surface-container-low shadow-sm">
		<div
			class="flex flex-col gap-3 border-b border-outline-variant/15 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between"
		>
			<div class="flex flex-wrap gap-2">
				{#each Object.entries(INVENTORY_COUNT_UI_FILTER_LABELS) as [filter, label] (filter)}
					<button
						type="button"
						onclick={() => (activeFilter = filter as InventoryCountUiFilter)}
						class={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${activeFilter === filter ? 'bg-brand-navy text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'}`}
					>
						{label}
					</button>
				{/each}
			</div>

			<div class="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
				<div class="relative min-w-0 flex-1 lg:w-[22rem] lg:flex-none">
					<Search
						class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline"
					/>
					<input
						type="search"
						bind:value={search}
						placeholder="Buscar por nombre, SKU o referencia"
						class="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-2.5 pl-10 text-sm text-on-surface"
					/>
				</div>
				<span class="text-xs text-on-surface-variant">{filteredLines.length} / {totalLines}</span>
			</div>
		</div>

		<DataGrid
			{columns}
			items={filteredLines}
			page={1}
			perPage={Math.max(filteredLines.length, 1)}
			total={filteredLines.length}
			totalPages={1}
			itemLabel="líneas"
			emptyTitle="Sin ítems para este filtro"
			emptySubtitle="Ajusta los filtros o registra conteos para ver resultados"
			onPageChange={() => {}}
		>
			{#snippet row(line)}
				{@const adjustmentPath = getAdjustmentPath(line)}
				{@const matched = isMatchedLine(line)}
				<tr
					class="bg-surface-container-lowest text-sm text-on-surface transition-colors hover:bg-surface-container-low"
				>
					<td class="px-4 py-3 align-top">
						<p class="font-semibold text-brand-navy">{line.itemName}</p>
						{#if line.notes}
							<p class="mt-1 text-xs text-on-surface-variant">{line.notes}</p>
						{/if}
					</td>
					<td class="px-4 py-3 align-top font-mono text-xs text-on-surface-variant">
						{line.itemCode ?? '—'}
					</td>
					<td class="px-4 py-3 text-right font-semibold text-brand-navy">{line.systemStock}</td>
					<td class="px-4 py-3 text-right">
						{#if isEditing(line.id)}
							<div class="ml-auto flex max-w-[12rem] flex-col items-end gap-1.5">
								<div class="flex items-center gap-2">
									<input
										type="number"
										bind:value={editing.count}
										min="0"
										class="w-20 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-right text-sm text-on-surface"
										onkeydown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												void handleSaveLine(line);
											}
											if (event.key === 'Escape') {
												event.preventDefault();
												stopEditing();
											}
										}}
									/>
									<button
										type="button"
										onclick={() => void handleSaveLine(line)}
										disabled={editing.isSaving}
										class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
									>
										<Check class="h-4 w-4" />
									</button>
								</div>

								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => (editing.showNotes = !editing.showNotes)}
										class="text-[11px] font-semibold text-brand-blue transition-colors hover:text-brand-navy"
									>
										{editing.showNotes ? 'Ocultar nota' : 'Agregar nota'}
									</button>
								</div>

								{#if editing.showNotes}
									<textarea
										bind:value={editing.notes}
										rows="2"
										class="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface"
										placeholder="Nota opcional"
									></textarea>
								{/if}
							</div>
						{:else if line.countedStock !== null}
							{#if !isReadonly}
								<button
									type="button"
									onclick={() => startEditing(line)}
									class="ml-auto inline-flex flex-col items-end rounded-lg text-right transition-colors hover:text-brand-navy"
								>
									<span class="font-semibold text-brand-navy">{line.countedStock}</span>
									<span class="text-xs text-on-surface-variant"
										>✓ {line.countedByName ?? 'Usuario'}</span
									>
								</button>
							{:else}
								<div class="space-y-1 text-right">
									<p class="font-semibold text-brand-navy">{line.countedStock}</p>
									<p class="text-xs text-on-surface-variant">✓ {line.countedByName ?? 'Usuario'}</p>
								</div>
							{/if}
						{:else}
							<span class="text-on-surface-variant">—</span>
						{/if}
					</td>
					<td class="px-4 py-3 text-right">
						{#if line.countedStock === null}
							<span class="text-on-surface-variant">—</span>
						{:else}
							<span
								class={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${differenceBadgeClass(line.difference)}`}
							>
								{formatDifference(line.difference)}
							</span>
						{/if}
					</td>
					<td class="px-4 py-3 text-on-surface-variant">
						{line.countedByName ?? '—'}
					</td>
					<td class="px-4 py-3 text-right">
						{#if isEditing(line.id)}
							<span class="text-on-surface-variant">—</span>
						{:else if line.countedStock === null}
							{#if !isReadonly}
								<button
									type="button"
									onclick={() => startEditing(line)}
									class="inline-flex items-center gap-2 rounded-lg bg-surface-container px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
								>
									Contar
								</button>
							{:else}
								<span class="text-on-surface-variant">—</span>
							{/if}
						{:else if matched}
							<span class="inline-flex items-center gap-1 text-xs font-semibold text-success">
								<Check class="h-3.5 w-3.5" />
								OK
							</span>
						{:else if adjustmentPath}
							<div class="flex flex-col items-end gap-1.5">
								<button
									type="button"
									onclick={() => openAdjustment(line)}
									class="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
								>
									{isReadonly ? 'Revisar ajuste ↗' : 'Ir a ajustar ↗'}
								</button>
								{#if session.status !== 'CANCELLED'}
									<label
										class="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant"
									>
										<input
											type="checkbox"
											checked={line.adjustmentCompleted}
											disabled={isAdjustmentStatusUpdating(line.id)}
											onchange={(event) => handleAdjustmentCheckboxChange(line, event)}
											class="h-3.5 w-3.5 rounded border border-outline-variant/35 text-brand-blue focus:ring-2 focus:ring-brand-blue/25"
										/>
										<span>Hecho</span>
									</label>
								{/if}
								{#if line.adjustmentCompleted}
									<span class="text-[11px] font-medium text-success">Ajustado</span>
								{/if}
							</div>
						{:else if !isReadonly}
							<button
								type="button"
								onclick={() => startEditing(line)}
								class="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
							>
								Contar
							</button>
						{:else}
							<span class="text-on-surface-variant">—</span>
						{/if}
					</td>
				</tr>
			{/snippet}

			{#snippet mobileCard(line)}
				{@const adjustmentPath = getAdjustmentPath(line)}
				{@const matched = isMatchedLine(line)}
				<div class="space-y-3">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="font-semibold text-brand-navy">{line.itemName}</p>
							<p class="mt-1 font-mono text-xs text-on-surface-variant">{line.itemCode ?? '—'}</p>
						</div>
						<AppBadge
							variant={line.difference && line.difference !== 0
								? line.difference > 0
									? 'success'
									: 'error'
								: 'neutral'}
						>
							{formatDifference(line.difference)}
						</AppBadge>
					</div>

					<div class="grid grid-cols-2 gap-3 text-sm">
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Sistema
							</p>
							<p class="mt-1 font-semibold text-brand-navy">{line.systemStock}</p>
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Contado
							</p>
							{#if isEditing(line.id)}
								<div class="mt-1 flex items-center gap-2">
									<input
										type="number"
										bind:value={editing.count}
										min="0"
										class="w-20 rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-right text-sm text-on-surface"
									/>
									<button
										type="button"
										onclick={() => void handleSaveLine(line)}
										disabled={editing.isSaving}
										class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
									>
										<Check class="h-4 w-4" />
									</button>
								</div>
							{:else if line.countedStock !== null && !isReadonly}
								<button
									type="button"
									onclick={() => startEditing(line)}
									class="mt-1 font-semibold text-brand-navy"
								>
									{line.countedStock}
								</button>
							{:else}
								<p class="mt-1 font-semibold text-brand-navy">{line.countedStock ?? '—'}</p>
							{/if}
						</div>
					</div>

					{#if isEditing(line.id)}
						<div class="space-y-2">
							<button
								type="button"
								onclick={() => (editing.showNotes = !editing.showNotes)}
								class="text-xs font-semibold text-brand-blue transition-colors hover:text-brand-navy"
							>
								{editing.showNotes ? 'Ocultar nota' : 'Agregar nota'}
							</button>
							{#if editing.showNotes}
								<textarea
									bind:value={editing.notes}
									rows="2"
									class="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface"
									placeholder="Nota opcional"
								></textarea>
							{/if}
						</div>
					{:else if adjustmentPath}
						<div class="space-y-2">
							<button
								type="button"
								onclick={() => openAdjustment(line)}
								class="inline-flex w-full items-center justify-center rounded-xl bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
							>
								{isReadonly ? 'Revisar ajuste ↗' : 'Ajustar →'}
							</button>
							{#if session.status !== 'CANCELLED'}
								<label
									class="flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface-variant"
								>
									<input
										type="checkbox"
										checked={line.adjustmentCompleted}
										disabled={isAdjustmentStatusUpdating(line.id)}
										onchange={(event) => handleAdjustmentCheckboxChange(line, event)}
										class="h-4 w-4 rounded border border-outline-variant/35 text-brand-blue focus:ring-2 focus:ring-brand-blue/25"
									/>
									<span>Hecho</span>
								</label>
							{/if}
							{#if line.adjustmentCompletedAt}
								<p class="text-xs text-on-surface-variant">
									{line.adjustmentCompletedByName ?? 'Usuario'} ·
									{formatDate(line.adjustmentCompletedAt, {
										dateStyle: 'short',
										timeStyle: 'short'
									})}
								</p>
							{/if}
						</div>
					{:else if matched}
						<div
							class="rounded-xl bg-success-container/60 px-3 py-3 text-sm font-semibold text-success"
						>
							Conteo OK
						</div>
					{:else if !isReadonly}
						<div class="space-y-2">
							<button
								type="button"
								onclick={() => startEditing(line)}
								class="w-full rounded-xl border border-outline-variant/35 bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
							>
								{line.countedStock === null ? 'Contar' : 'Editar conteo'}
							</button>
						</div>
					{/if}
				</div>
			{/snippet}
		</DataGrid>
	</section>

	{#if showApplyModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget && !isApplying) {
					showApplyModal = false;
				}
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="inventory-count-apply-title"
				class="w-full max-w-lg rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
			>
				<div class="flex items-start gap-3">
					<div
						class="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-container text-on-warning-container"
					>
						<TriangleAlert class="h-5 w-5" />
					</div>
					<div>
						<h2 id="inventory-count-apply-title" class="text-xl font-semibold text-brand-navy">
							Cerrar sesión de conteo
						</h2>
						<p class="mt-1 text-sm text-on-surface-variant">
							Vas a cerrar esta sesión de conteo. Se registrará el informe de diferencias pero NO se
							aplicará ningún ajuste automático de stock. Los ajustes deben hacerse manualmente
							desde cada producto o lente usando el botón "Ir a ajustar".
						</p>
					</div>
				</div>

				<div class="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
					<div class="rounded-2xl bg-surface-container px-4 py-3">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Contados
						</p>
						<p class="mt-1 font-semibold text-brand-navy">{countedTotal}</p>
					</div>
					<div class="rounded-2xl bg-surface-container px-4 py-3">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Sin diferencia
						</p>
						<p class="mt-1 font-semibold text-brand-navy">{matchedLines.length}</p>
					</div>
					<div class="rounded-2xl bg-surface-container px-4 py-3">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Pendientes
						</p>
						<p class="mt-1 font-semibold text-brand-navy">{pendingTotal}</p>
					</div>
					<div class="rounded-2xl bg-surface-container px-4 py-3">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Diferencias +
						</p>
						<p class="mt-1 font-semibold text-success">
							{positiveDiffLines.length} ítems / +{positiveUnits}
						</p>
					</div>
					<div class="rounded-2xl bg-surface-container px-4 py-3">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Diferencias -
						</p>
						<p class="mt-1 font-semibold text-error">
							{negativeDiffLines.length} ítems / -{negativeUnits}
						</p>
					</div>
				</div>

				<div
					class="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
				>
					{pendingManualAdjustments} ítems con diferencia pendientes de ajuste manual.
				</div>

				{#if pendingTotal > 0}
					<div
						class="mt-4 rounded-2xl border border-warning/15 bg-warning-container/40 px-4 py-3 text-sm text-on-surface-variant"
					>
						No puedes cerrar la sesión todavía. Faltan {pendingTotal} ítems por contar o confirmar.
					</div>
				{/if}

				<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						onclick={() => (showApplyModal = false)}
						disabled={isApplying}
						class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
					>
						Cancelar
					</button>
					<button
						type="button"
						onclick={() => void handleApplySession()}
						disabled={isApplying || !canCloseSession}
						class="rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
					>
						{isApplying ? 'Cerrando...' : 'Cerrar sesión de conteo'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showCancelModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget && !isCancelling) {
					showCancelModal = false;
				}
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="inventory-count-cancel-title"
				class="w-full max-w-lg rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
			>
				<h2 id="inventory-count-cancel-title" class="text-xl font-semibold text-brand-navy">
					Cancelar sesión
				</h2>
				<p class="mt-2 text-sm text-on-surface-variant">
					La sesión quedará en solo lectura y no se generará ningún ajuste.
				</p>

				<label class="mt-5 block space-y-2">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
						>Motivo</span
					>
					<textarea
						bind:value={cancelReason}
						rows="4"
						class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-4 py-3 text-sm text-on-surface"
						placeholder="Indica por qué se cancela la sesión"
					></textarea>
				</label>

				<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						onclick={() => (showCancelModal = false)}
						disabled={isCancelling}
						class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
					>
						Volver
					</button>
					<button
						type="button"
						onclick={() => void handleCancelSession()}
						disabled={isCancelling}
						class="rounded-xl bg-error px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
					>
						{isCancelling ? 'Cancelando...' : 'Confirmar cancelación'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
