<script lang="ts">
	import { goto, resolve } from '$app/navigation';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getInventoryCountContext } from '$lib/context';
	import {
		applyAdjustmentsBatchCmd,
		applyLineAdjustmentCmd,
		applySessionCmd,
		cancelSession as cancelSessionCmd,
		confirmZeroStock,
		createSessionCmd,
		previewCountScope,
		recountCountLineCmd,
		setSessionResponsibles,
		updateCountSettings,
		upsertCountLineCmd,
		getCountConfig
	} from '$lib/remote/inventoryCount.remote';
	import CountBoard from '$lib/components/inventory/count/CountBoard.svelte';
	import SessionHeaderBar from '$lib/components/inventory/count/SessionHeaderBar.svelte';
	import SummaryStrip from '$lib/components/inventory/count/SummaryStrip.svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import MultiCombobox from '$lib/components/inventory/count/ui/MultiCombobox.svelte';
	import SelectInput from '$lib/components/ui/SelectInput.svelte';
	import {
		ALL_ADJUSTMENT_REASONS,
		ADJUSTMENT_REASON_LABELS,
		type AdjustmentReason
	} from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';
	import type { CountCycleConfig } from '$lib/shared/inventoryCount';
	import { computeCountStats, finalCount, lineDiff } from '$lib/shared/inventoryCount';
	import type {
		CountLineRow,
		CountSessionDetail,
		ResponsibleRow
	} from '$lib/server/db/queries/inventoryCount/types';

	let { data } = $props();

	const initialSession = untrack(() => data.session) as CountSessionDetail;
	const initialConfig = untrack(() => data.config) as CountCycleConfig;
	const initialUser = untrack(() => data.user);
	const initialCosts = untrack(() => data.costs);
	const initialRecount = untrack(() => data.recountsByLine);
	const initialAdjusted = untrack(() => data.adjusted);
	const initialAccess = untrack(() => data.canCount);

	let session = $state<CountSessionDetail>(initialSession);
	let lines = $state<CountLineRow[]>(initialSession.lines);
	let responsibles = $state<ResponsibleRow[]>(initialSession.responsibles);
	let phase = $state<1 | 2 | 3>(1);
	let search = $state('');
	let mobileMode = $state<'ficha' | 'lista'>('lista');
	let isMobileView = $state(false);
	let isSubmitting = $state(false);

	// Drawer de ajuste de línea
	let adjustPanel = $state<{ line: CountLineRow } | null>(null);
	let adjustReason = $state<AdjustmentReason>('PHYSICAL_COUNT');
	let adjustReasonText = $state('');
	let confirmAdjustedModal = $state(false);
	// Drawer de responsables
	let responsiblesPanel = $state(false);
	let pendingResponsibles = $state<
		Array<{ userId: string | null; displayName: string; isExternal: boolean }>
	>([]);
	// Modal de cancelar
	let cancelModal = $state(false);
	let cancelReason = $state('');

	// Sincronizar nombre de responsable externo (fake dialog values)
	let responsibleOptions = $state<Array<{ userId: string; displayName: string }>>(
		(
			session.responsibles.filter((entry) => entry.userId != null) as Array<{
				userId: string | null;
				displayName: string;
			}> as unknown as Array<{ userId: string; displayName: string }>
		).map((entry) => ({
			userId: entry.userId!,
			displayName: entry.displayName
		}))
	);

	const costByLineId = $derived(
		new Map<number, number | null>(
			Object.entries(initialCosts ?? {}).map(([key, value]) => [
				Number(key),
				value as number | null
			])
		)
	);
	const stats = $derived(computeCountStats(lines, initialConfig, costByLineId));
	const canCloseNow = $derived(
		stats.pendingCounting === 0 && stats.recountsPending === 0 && lines.length > 0
	);
	const canManage = $derived(data.canManage as boolean);
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

	$effect(() => {
		const mq = window.matchMedia('(max-width: 1023px)');
		const update = () => (isMobileView = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

	function handlePhaseCta(): void {
		if (phase === 1) {
			if (stats.pendingCounting > 0) return;
			phase = 2;
			return;
		}
		if (phase === 2 && canCloseNow) {
			void applyNow();
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

	async function handleSubmitSave(lineId: number, value: number): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		const previous = lines;
		try {
			// Optimista: el update del estado se hace al regresar la respuesta
			const response = await upsertCountLineCmd({ lineId, countedStock: value });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			lines = lines.map((line) => (line.id === response.data.id ? response.data : line));
		} catch (error) {
			lines = previous;
			toast.error(getErrorMessage(error, 'No se pudo guardar el conteo'));
		} finally {
			isSubmitting = false;
		}
	}

	async function handleConfirmZero(): Promise<void> {
		const response = await confirmZeroStock({ sessionId: session.id });
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		toast.success('Stock 0 confirmado en lote');
		await refreshLines();
	}

	async function refreshLines(): Promise<void> {
		const { getSessionLines } = await import('$lib/remote/inventoryCount.remote');
		const response = await getSessionLines({ sessionId: session.id, filter: 'ALL' });
		lines = response as CountLineRow[];
	}

	async function submitRecount(line: CountLineRow, raw: string): Promise<void> {
		const numeric = Number.parseInt(raw, 10);
		if (Number.isNaN(numeric) || numeric < 0) {
			toast.error('Escribe el recuento y pulsa Enter.');
			return;
		}
		const response = await recountCountLineCmd({ lineId: line.id, recountedStock: numeric });
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		lines = lines.map((candidate) =>
			candidate.id === response.data.id ? response.data : candidate
		);
	}

	async function applyLineAdjustmentInternal(line: CountLineRow): Promise<void> {
		if (adjustReason === 'OTHER' && !adjustReasonText.trim()) {
			toast.error('Escribe el motivo');
			return;
		}
		const response = await applyLineAdjustmentCmd({
			lineId: line.id,
			reason: adjustReason,
			reasonText: adjustReason === 'OTHER' ? adjustReasonText.trim() : null
		});
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		lines = lines.map((candidate) =>
			candidate.id === response.data.id ? response.data : candidate
		);
		closeAdjustPanel();
		toast.success(`Ajuste aplicado (${ADJUSTMENT_REASON_LABELS[data.reason]})`); // fake toast
	}

	async function applyBatchInternal(): Promise<void> {
		if (adjustReason === 'OTHER' && !adjustReasonText.trim()) {
			toast.error('Escribe el motivo');
			return;
		}
		const response = await applyAdjustmentsBatchCmd({
			sessionId: session.id,
			reason: adjustReason,
			reasonText: adjustReason === 'OTHER' ? adjustReasonText.trim() : null
		});
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		await refreshLines();
		toast.success(`${response.data} ajustes aplicados`);
	}

	function closeAdjustPanel(): void {
		adjustPanel = null;
		adjustReason = 'PHYSICAL_COUNT';
		adjustReasonText = '';
	}

	function openAdjust(line: CountLineRow): void {
		adjustPanel = { line };
		adjustReason = 'PHYSICAL_COUNT';
		adjustReasonText = '';
		confirmAdjustedModal = false;
	}

	async function doCancelSession(): Promise<void> {
		if (cancelReason.trim().length < 5) {
			toast.error('El motivo necesita al menos 5 caracteres');
			return;
		}
		const response = await cancelSessionCmd({ id: session.id, reason: cancelReason.trim() });
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		session = response.data;
		lines = response.data.lines;
		countContext.activeSession = null;
		cancelModal = false;
		toast.success('Sesión cancelada');
		await goto(resolve('/inventory/count'), { replaceState: true });
	}

	async function saveResponsibles(): Promise<void> {
		const response = await setSessionResponsibles({
			sessionId: session.id,
			entries: pendingResponsibles
		});
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		responsibles = response.data;
		responsiblesPanel = false;
		toast.success('Responsables actualizados');
	}

	function goBack(): void {
		session = { ...session, lines };
		countContext.activeSession = session.status === 'OPEN' ? { id: session.id } : null;
		void goto(resolve('/inventory/count'), { replaceState: true });
	}
</script>

<svelte:head>
	<title>Conteo #{session.id} · Conteo físico · Optikt</title>
</svelte:head>
