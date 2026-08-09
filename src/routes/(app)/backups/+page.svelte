<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw, Play, HardDrive } from '@lucide/svelte';
	import { getErrorMessage } from '$lib/utils';
	import { untrack } from 'svelte';
	import {
		listBackupHistory,
		getBackupStatus,
		runBackup,
		type BackupHistoryItem,
		type BackupStatus
	} from '$lib/remote/backups.remote';
	import { BackupsStatusBadge, BackupsTable } from '$lib/components/backups';

	let { data } = $props();
	let { initialHistory } = untrack(() => data);

	let history = $state<BackupHistoryItem[]>(initialHistory);
	let status = $state<BackupStatus | null>(null);
	let loading = $state(false);
	let running = $state(false);

	async function fetchAll() {
		loading = true;
		try {
			const [historyData, statusData] = await Promise.all([
				listBackupHistory({ limit: 50 }),
				getBackupStatus({})
			]);
			history = historyData;
			status = statusData;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando backups'));
		} finally {
			loading = false;
		}
	}

	async function handleRunBackup() {
		running = true;
		try {
			await runBackup({});
			toast.success('Backup iniciado. Recibirás una notificación al completar.');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error iniciando backup'));
		} finally {
			running = false;
		}
	}

	// Load initial status after mount (notifications table read is fast)
	let statusLoaded = $state(false);
	$effect(() => {
		if (statusLoaded) return;
		getBackupStatus({})
			.then((s) => {
				status = s;
			})
			.catch((e) => {
				console.error('Error cargando estado de backups', e);
			})
			.finally(() => {
				statusLoaded = true;
			});
	});
</script>

<svelte:head>
	<title>Backups - Optikt</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-brand-navy">Backups</h1>
			<p class="text-outline">Backups de base de datos</p>
			{#if status}
				<div class="mt-3">
					<BackupsStatusBadge {status} />
				</div>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={fetchAll} disabled={loading}>
				<RefreshCw class="mr-2 h-4 w-4" />
				Refrescar
			</Button>
			<Button onclick={handleRunBackup} disabled={running}>
				<Play class="mr-2 h-4 w-4" />
				{running ? 'Ejecutando...' : 'Ejecutar backup ahora'}
			</Button>
		</div>
	</div>

	<div class="rounded-xl border border-slate-200 bg-white">
		<BackupsTable items={history} {loading} />
	</div>

	{#if history.length === 0 && !loading}
		<div
			class="mt-4 flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
		>
			<HardDrive class="h-4 w-4" />
			Los resultados aparecen cuando el Schedule Job de Dokploy ejecuta un backup y el webhook notifica
			a la app.
		</div>
	{/if}
</div>
