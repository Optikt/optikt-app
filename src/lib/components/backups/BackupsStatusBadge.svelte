<script lang="ts">
	import type { BackupStatus } from '$lib/remote/backups.remote';
	import { formatDate } from '$lib/utils';

	interface Props {
		status: BackupStatus;
	}

	let { status }: Props = $props();

	const dotClass = {
		healthy: 'bg-green-500',
		stale: 'bg-yellow-500',
		failing: 'bg-red-500',
		unknown: 'bg-gray-400'
	};
</script>

<div class="flex flex-wrap items-center gap-2">
	<span class={['inline-block h-2.5 w-2.5 rounded-full', dotClass[status.status]].join(' ')}></span>
	<span class="text-sm font-medium">{status.label}</span>
	{#if status.lastBackupAt}
		<span class="text-xs text-outline">
			· Último: {formatDate(status.lastBackupAt, {
				dateStyle: 'short',
				timeStyle: 'short'
			})}
		</span>
	{/if}
</div>
