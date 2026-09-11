<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { getInventoryCountContext } from '$lib/context';
	import {
		applySession,
		cancelSession,
		setLineAdjustmentStatus,
		upsertCountLine
	} from '$lib/remote/inventoryCount.remote';
	import {
		canCloseInventoryCountSession,
		type InventoryCountUiFilter
	} from '$lib/schemas/inventoryCount';
	import { isAdminRole } from '$lib/shared/enums';
	import type {
		InventoryCountLineRow,
		InventoryCountSessionDetail
	} from '$lib/server/db/queries/inventoryCount';
	import { getErrorMessage } from '$lib/utils';
	import CountSessionHeader from '$lib/components/inventory/count/CountSessionHeader.svelte';
	import CountSummaryMetrics from '$lib/components/inventory/count/CountSummaryMetrics.svelte';
	import CountLinesTable from '$lib/components/inventory/count/CountLinesTable.svelte';
	import {
		createEmptyLineEditing,
		startLineEditing,
		type CountLineEditing
	} from '$lib/components/inventory/count/CountLineEditRow.svelte';
	import CountActionModals from '$lib/components/inventory/count/CountActionModals.svelte';
	import {
		buildSummaryMessage,
		buildSummaryMetrics,
		computeCountStats,
		filterCountLines
	} from '$lib/components/inventory/count/countSummary';
	import {
		getAdjustmentPath,
		isAdjustmentStatusUpdating,
		toggleUpdatingId
	} from '$lib/components/inventory/count/countAdjustments';

	let { data } = $props();
	const inventoryCountContext = getInventoryCountContext();
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
	let editing = $state<CountLineEditing>(createEmptyLineEditing());

	const currentUser = $derived(data.user);
	const canManage = $derived(isAdminRole(currentUser.role));
	const isReadonly = $derived(session.status !== 'OPEN');
	const stats = $derived(computeCountStats(lines));
	const canCloseSession = $derived(
		canCloseInventoryCountSession(stats.total, stats.counted)
	);
	const filteredLines = $derived(filterCountLines(lines, activeFilter, search));
	const summaryMetrics = $derived(buildSummaryMetrics(stats));
	const summary = $derived(
		buildSummaryMessage({
			status: session.status,
			notes: session.notes,
			cancelReason: session.cancelReason,
			canClose: canCloseSession,
			pendingTotal: stats.pending,
			diffCount: stats.diffCount,
			pendingAdjustments: stats.pendingAdjustments
		})
	);

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

	async function toggleAdjustmentCompleted(
		line: InventoryCountLineRow,
		adjustmentCompleted: boolean
	) {
		if (isAdjustmentStatusUpdating(line.id, updatingAdjustmentLineIds)) {
			return;
		}

		updatingAdjustmentLineIds = toggleUpdatingId(updatingAdjustmentLineIds, line.id, true);

		try {
			const result = await setLineAdjustmentStatus({ lineId: line.id, adjustmentCompleted });

			if (!result.success) {
				throw new Error(result.error ?? 'No se pudo actualizar el seguimiento del ajuste');
			}

			updateLineLocally(result.line);
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo actualizar el tracking del ajuste'));
		} finally {
			updatingAdjustmentLineIds = toggleUpdatingId(updatingAdjustmentLineIds, line.id, false);
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

		editing = startLineEditing(line);
	}

	function stopEditing() {
		editing = createEmptyLineEditing();
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
			inventoryCountContext.activeSession = null;
			showApplyModal = false;
			stopEditing();
			toast.success('Sesión de conteo cerrada');
		} catch (error) {
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
			inventoryCountContext.activeSession = null;
			showCancelModal = false;
			cancelReason = '';
			stopEditing();
			toast.success('Sesión cancelada');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo cancelar la sesión'));
		} finally {
			isCancelling = false;
		}
	}
</script>

<svelte:head>
	<title>Sesión #{session.id} - Conteo Físico - Optikt</title>
</svelte:head>

<div class="space-y-4 p-3 sm:p-4 lg:px-4 lg:py-4">
	<CountSessionHeader
		sessionId={session.id}
		status={session.status}
		{canManage}
		{canCloseSession}
		onBack={goBack}
		onOpenApply={() => (showApplyModal = true)}
		onOpenCancel={() => (showCancelModal = true)}
	/>

	<CountSummaryMetrics
		{session}
		stats={stats}
		metrics={summaryMetrics}
		messageLabel={summary.label}
		message={summary.message}
	/>

	<CountLinesTable
		lines={filteredLines}
		totalLines={stats.total}
		bind:activeFilter
		bind:search
		isReadonly={isReadonly}
		sessionCancelled={session.status === 'CANCELLED'}
		bind:editing
		onStartEditing={startEditing}
		onSaveLine={(line) => void handleSaveLine(line)}
		onStopEditing={stopEditing}
		onOpenAdjustment={openAdjustment}
		onAdjustmentChange={handleAdjustmentCheckboxChange}
		isAdjustmentUpdating={(lineId) => isAdjustmentStatusUpdating(lineId, updatingAdjustmentLineIds)}
	/>

	<CountActionModals
		bind:showApplyModal
		bind:showCancelModal
		bind:cancelReason
		countedTotal={stats.counted}
		matchedCount={stats.matchedCount}
		pendingTotal={stats.pending}
		positiveDiffCount={stats.positiveDiffCount}
		positiveUnits={stats.positiveUnits}
		negativeDiffCount={stats.negativeDiffCount}
		negativeUnits={stats.negativeUnits}
		pendingManualAdjustments={stats.pendingAdjustments}
		{isApplying}
		{isCancelling}
		{canCloseSession}
		onApply={() => void handleApplySession()}
		onCancel={() => void handleCancelSession()}
	/>
</div>
