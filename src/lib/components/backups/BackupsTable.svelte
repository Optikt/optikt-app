<script lang="ts">
	import { HardDrive } from '@lucide/svelte';
	import { DataGrid, AppBadge } from '$lib/components/ui';
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

	const columns = [
		{ key: 'file', label: 'Archivo' },
		{ key: 'size', label: 'Tamaño' },
		{ key: 'date', label: 'Fecha' },
		{ key: 'status', label: 'Estado' }
	];
</script>

<DataGrid
	{columns}
	{items}
	{loading}
	emptyTitle="No hay historial de backups"
	emptySubtitle="Configurá el Schedule Job en Dokploy y los backups aparecerán acá."
>
	{#snippet emptyIcon()}
		<HardDrive class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(item)}
		<tr class="transition-colors hover:bg-surface-container-low">
			<td class="px-3 py-2.5 font-mono text-sm">{item.fileName ?? '-'}</td>
			<td class="px-3 py-2.5 text-sm">{formatBytes(item.sizeBytes)}</td>
			<td class="px-3 py-2.5 text-sm">
				{formatDate(item.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
			</td>
			<td class="px-3 py-2.5">
				{#if item.type === 'BACKUP_CREATED'}
					<AppBadge variant="success">Éxito</AppBadge>
				{:else}
					<AppBadge variant="error">Fallido</AppBadge>
				{/if}
			</td>
		</tr>
	{/snippet}
</DataGrid>
