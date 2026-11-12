<script lang="ts">
	import { CircleX, TriangleAlert } from '@lucide/svelte';
	import { RefundStatus } from '$lib/shared/enums';
	import { formatDate, formatPrice } from '$lib/utils';
	import { refundDecisionTitle } from './saleDetail';

	interface Props {
		isCancelled: boolean;
		refundStatus: string | null;
		refundAmount: number | null;
		refundNotes: string | null;
		cancellationReason: string | null;
		cancelledAt: string | null;
		cancelledByName: string | null;
		pendingFreeItemCount: number;
		/** Pending-free-items notice only for roles that can act on it. */
		canAct: boolean;
	}

	let {
		isCancelled,
		refundStatus,
		refundAmount,
		refundNotes,
		cancellationReason,
		cancelledAt,
		cancelledByName,
		pendingFreeItemCount,
		canAct
	}: Props = $props();

	const showRefundAmount = $derived(
		isCancelled &&
			refundStatus !== null &&
			refundStatus !== RefundStatus.NO_PAYMENT &&
			refundAmount !== null
	);
</script>

{#if isCancelled}
	<div
		class="anim-page mt-3 flex items-start gap-2.5 rounded-lg bg-error-container px-4 py-2.5 text-on-error-container"
		role="status"
	>
		<CircleX class="mt-0.5 h-4 w-4 shrink-0" />
		<div class="min-w-0">
			<p class="text-[13px] font-semibold">
				{refundDecisionTitle(refundStatus)}{#if showRefundAmount}&nbsp;· {formatPrice(
						refundAmount ?? 0
					)}{/if}
			</p>
			<p class="text-xs font-medium opacity-80">
				Cancelada por {cancelledByName ?? 'Usuario no disponible'} · {cancelledAt
					? formatDate(cancelledAt, { dateStyle: 'medium', timeStyle: 'short' })
					: '—'} · Motivo: {cancellationReason ?? 'Sin motivo registrado'}
			</p>
			{#if refundStatus !== RefundStatus.NO_PAYMENT && refundNotes}
				<p class="mt-0.5 text-xs font-medium opacity-80">{refundNotes}</p>
			{/if}
		</div>
	</div>
{/if}

{#if pendingFreeItemCount > 0 && canAct}
	<div
		class="anim-page mt-3 flex items-center gap-2 rounded-lg bg-warning-container px-4 py-2.5 text-[13px] font-semibold text-on-warning-container"
		role="status"
	>
		<TriangleAlert class="h-4 w-4 shrink-0" />
		{pendingFreeItemCount}
		{pendingFreeItemCount === 1 ? 'ítem libre pendiente' : 'ítems libres pendientes'} de completar
	</div>
{/if}
