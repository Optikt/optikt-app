<script lang="ts">
	import { CircleCheck, CircleX, Clock3 } from '@lucide/svelte';
	import type { SalesStats } from '$lib/server/db/queries/sales';

	let { stats }: { stats: SalesStats } = $props();
</script>

<dl class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<dt class="text-on-surface-variant">Mensuales:</dt>
		<dd class="font-semibold text-brand-navy">{stats.monthly}</dd>
	</div>
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<Clock3 class="h-3 w-3 text-warning" />
		<dt class="text-on-surface-variant">Pendientes:</dt>
		<dd class="font-semibold text-brand-navy">{stats.pending}</dd>
	</div>
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<CircleCheck class="h-3 w-3 text-success" />
		<dt class="text-on-surface-variant">Completadas:</dt>
		<dd class="font-semibold text-brand-navy">{stats.completed}</dd>
	</div>
	<div class="inline-flex items-center gap-1 whitespace-nowrap">
		<CircleX class="h-3 w-3 text-error" />
		<dt class="text-on-surface-variant">Canceladas:</dt>
		<dd class="font-semibold text-brand-navy">{stats.cancelled}</dd>
	</div>
</dl>
