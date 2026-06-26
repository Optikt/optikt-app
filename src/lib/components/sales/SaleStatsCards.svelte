<script lang="ts">
	import { CircleCheck, CircleX, Clock3, ReceiptText } from '@lucide/svelte';
	import type { SalesStats } from '$lib/server/db/queries/sales';

	let { stats }: { stats: SalesStats } = $props();
</script>

<dl class="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4 lg:gap-4">
	<!-- Monthly -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<ReceiptText class="h-4 w-4 shrink-0 text-on-surface-variant lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.monthly}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Ventas mensuales
			</dt>
		</div>
	</div>

	<!-- Pending -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<Clock3 class="h-4 w-4 shrink-0 text-warning lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.pending}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Pendientes
			</dt>
		</div>
	</div>

	<!-- Completed -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<CircleCheck class="h-4 w-4 shrink-0 text-success lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.completed}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Completadas
			</dt>
		</div>
	</div>

	<!-- Cancelled -->
	<div
		class="flex flex-col items-start gap-1 rounded-lg bg-surface-container-low px-3 py-2 lg:flex-row lg:items-center lg:gap-2 lg:px-3.5 lg:py-2.5"
	>
		<CircleX class="h-4 w-4 shrink-0 text-error lg:h-5 lg:w-5" />
		<div class="min-w-0">
			<dd class="font-heading text-xl leading-tight font-bold text-brand-navy lg:text-xl">
				{stats.cancelled}
			</dd>
			<dt
				class="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase lg:text-[11px]"
			>
				Canceladas
			</dt>
		</div>
	</div>
</dl>
