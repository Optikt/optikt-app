<script lang="ts">
	import { HardDrive } from '@lucide/svelte';
	import { DataTable, AppBadge } from '$lib/components/ui';
	import { formatDate } from '$lib/utils';
	import type { BackupHistoryItem } from '$lib/remote/backups.remote';

	interface Props {
		items: BackupHistoryItem[];
		loading?: boolean;
	}

	let { items, loading = false }: Props = $props();

	function formatBytes(bytes: number | null): string {
		if (bytes == null) return '-';
		const units = ['B', 'KB', 'MB', 'GB'];
		let value = bytes;
		let unit = 0;
		while (value >= 1024 && unit < units.length - 1) {
			value /= 1024;
			unit++;
		}
		return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
	}
</script>

<DataTable
	{items}
	{loading}
	emptyIcon={HardDrive}
	emptyTitle="No hay historial de backups"
	emptyDescription="Configurá el Schedule Job en Dokploy y los backups aparecerán acá."
>
	{#snippet header()}
		<th class="px-4 py-3 text-xs font-semibold tracking-wider text-outline uppercase">Archivo</th>
		<th class="px-4 py-3 text-xs font-semibold tracking-wider text-outline uppercase">Tamaño</th>
		<th class="px-4 py-3 text-xs font-semibold tracking-wider text-outline uppercase">Fecha</th>
		<th class="px-4 py-3 text-xs font-semibold tracking-wider text-outline uppercase">Estado</th>
	{/snippet}

	{#snippet row(item)}
		<td class="px-4 py-3 font-mono text-sm">{item.fileName ?? '-'}</td>
		<td class="px-4 py-3 text-sm">{formatBytes(item.sizeBytes)}</td>
		<td class="px-4 py-3 text-sm">
			{formatDate(item.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
		</td>
		<td class="px-4 py-3">
			{#if item.type === 'BACKUP_CREATED'}
				<AppBadge variant="success">Éxito</AppBadge>
			{:else}
				<AppBadge variant="error">Fallido</AppBadge>
			{/if}
		</td>
	{/snippet}
</DataTable>
