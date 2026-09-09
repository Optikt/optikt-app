<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import { getInventoryCountStatusLabel } from '$lib/schemas/inventoryCount';

	interface Props {
		status: string;
		sessionNumber?: number | string;
		onBack: () => void;
	}

	let { status, sessionNumber, onBack }: Props = $props();

	let statusLabel = $derived(getInventoryCountStatusLabel(status));
</script>

<header class="flex items-center justify-between">
	<div class="flex items-center gap-3">
		<button type="button" onclick={onBack} class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
			<ArrowLeft class="h-4 w-4" />
		</button>
		<div>
			<h1 class="text-lg font-bold text-brand-navy dark:text-white">Conteo #{sessionNumber ?? '—'}</h1>
			<p class="text-xs text-slate-500 dark:text-slate-400">Sesión de conteo físico</p>
		</div>
	</div>
	<AppBadge variant={status === 'OPEN' ? 'info' : status === 'APPLIED' ? 'success' : 'warning'}>{statusLabel}</AppBadge>
</header>
