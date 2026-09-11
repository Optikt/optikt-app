<script lang="ts">
	import { CircleX, FileText } from '@lucide/svelte';
	import { RefundStatus } from '$lib/shared/enums';
	import { formatDate, formatPrice } from '$lib/utils';
	import { refundCardClasses, refundDecisionTitle } from './saleDetail';

	interface Props {
		notes: string | null;
		isCancelled: boolean;
		refundStatus: string | null;
		refundAmount: number | null;
		refundNotes: string | null;
		cancellationReason: string | null;
		cancelledAt: string | null;
		cancelledByName: string | null;
		pendingFreeItemCount: number;
	}

	let {
		notes,
		isCancelled,
		refundStatus,
		refundAmount,
		refundNotes,
		cancellationReason,
		cancelledAt,
		cancelledByName,
		pendingFreeItemCount
	}: Props = $props();
</script>

{#if notes || isCancelled}
	<div class="mb-6 grid gap-4 lg:grid-cols-2">
		{#if notes}
			<section class="rounded-xl border border-gray-100/50 bg-white px-5 py-4 shadow-sm">
				<div class="flex items-start gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
					>
						<FileText class="h-5 w-5" />
					</div>
					<div>
						<p class="text-sm font-medium text-gray-500">Observaciones</p>
						<p class="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
							{notes}
						</p>
					</div>
				</div>
			</section>
		{/if}

		{#if isCancelled}
			<section class="rounded-xl border p-5 shadow-sm {refundCardClasses(refundStatus)}">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/30">
						<CircleX class="h-5 w-5" />
					</div>
					<div class="space-y-3">
						<div>
							<p class="text-sm font-medium opacity-70">Estado de cancelación</p>
							<h2 class="mt-1.5 text-xl font-semibold text-current">
								{refundDecisionTitle(refundStatus)}
							</h2>
							<p class="mt-1 text-sm leading-relaxed text-current/80">
								{cancellationReason ?? 'Sin motivo registrado'}
							</p>
						</div>

						<div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-current/85">
							{#if cancelledAt}
								<span
									>{formatDate(cancelledAt, {
										dateStyle: 'medium',
										timeStyle: 'short'
									})}</span
								>
							{/if}
							{#if cancelledByName}
								<span>Por: {cancelledByName}</span>
							{/if}
						</div>

						{#if refundStatus && refundStatus !== RefundStatus.NO_PAYMENT}
							<div class="rounded-xl bg-white/30 px-4 py-3 text-sm">
								<p class="text-sm font-medium opacity-70">Resolución financiera</p>
								<p class="mt-1 font-mono text-lg font-semibold text-current">
									{formatPrice(refundAmount ?? 0)}
								</p>
								{#if refundNotes}
									<p class="mt-1 text-sm whitespace-pre-wrap text-current/80">
										{refundNotes}
									</p>
								{/if}
							</div>
						{:else if refundStatus === RefundStatus.NO_PAYMENT}
							<div class="rounded-xl bg-white/30 px-4 py-3 text-sm text-current/85">
								Sin pagos previos, no aplica reembolso.
							</div>
						{/if}
					</div>
				</div>
			</section>
		{/if}
	</div>
{/if}

{#if pendingFreeItemCount > 0}
	<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
		<p class="text-sm font-semibold text-amber-800">
			⚠ {pendingFreeItemCount}
			{pendingFreeItemCount === 1 ? 'ítem libre pendiente' : 'ítems libres pendientes'} de completar.
		</p>
	</div>
{/if}
