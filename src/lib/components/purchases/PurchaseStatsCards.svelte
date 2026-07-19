<script lang="ts">
	import { CheckCircle2, ClipboardCheck, Coins, FileClock } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';

	interface PurchaseStats {
		confirmed: number;
		draftInProgress: number;
		draftReady: number;
		monthlySpend: number;
	}

	let { stats }: { stats: PurchaseStats } = $props();
</script>

<dl class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<CheckCircle2 class="h-3 w-3 text-success" />
		<dt class="text-on-surface-variant">Confirmadas:</dt>
		<dd class="font-semibold text-brand-navy">{stats.confirmed}</dd>
	</div>
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<FileClock class="h-3 w-3 text-on-surface-variant" />
		<dt class="text-on-surface-variant">En prep.:</dt>
		<dd class="font-semibold text-brand-navy">{stats.draftInProgress}</dd>
	</div>
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<ClipboardCheck class="h-3 w-3 text-warning" />
		<dt class="text-on-surface-variant">Listas:</dt>
		<dd class="font-semibold text-brand-navy">{stats.draftReady}</dd>
	</div>
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<Coins class="h-3 w-3 text-info" />
		<dt class="text-on-surface-variant">Recibido:</dt>
		<dd class="font-semibold text-brand-navy">{formatPrice(stats.monthlySpend)}</dd>
	</div>
</dl>
