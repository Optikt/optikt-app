<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { Settings, Plus, Play } from '@lucide/svelte';
	import { getInventoryCountContext } from '$lib/context';
	import {
		createSessionCmd,
		updateCountSettings as saveCountSettings
	} from '$lib/remote/inventoryCount.remote';
	import { getErrorMessage } from '$lib/utils';
	import CycleCard from '$lib/components/inventory/count/CycleCard.svelte';
	import GroupsCoverageCard from '$lib/components/inventory/count/GroupsCoverageCard.svelte';
	import HistoryList from '$lib/components/inventory/count/HistoryList.svelte';
	import NewCountPanel from '$lib/components/inventory/count/NewCountPanel.svelte';
	import CycleSettingsPanel from '$lib/components/inventory/count/CycleSettingsPanel.svelte';
	import CountTabs from '$lib/components/inventory/count/ui/CountSegmented.svelte';
	import CountButton from '$lib/components/inventory/count/ui/CountButton.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { CoverageData } from '$lib/server/db/queries/inventoryCount/coverage';
	import type { CountCycleConfig } from '$lib/shared/inventoryCount';
	import type { CountCycleConfig as _CountCycleConfig2 } from '$lib/shared/inventoryCount';
	import type { CoverageDim } from '$lib/server/db/queries/inventoryCount/coverage';
	import type { CountSessionSummary } from '$lib/server/db/queries/inventoryCount/types';

	interface Tag {
		key: string;
		label: string;
	}

	let { data } = $props();

	const initialConfig = untrack(() => data.config);
	const coverageSnapshot = untrack(() => data.coverage) as CoverageData;
	const initialSessions = untrack(() => data.sessions) as CountSessionSummary[];
	const initialUsers = untrack(() => data.responsibleOptions);

	let sessions = $state<CountSessionSummary[]>(initialSessions);
	const sessionCountContext = getInventoryCountContext();
	// La sesión activa puede cambiar desde el módulo (crear/cerrar).
	const activeSessionId = $derived(sessionCountContext.activeSession?.id ?? null);
	const activeSession = $derived(sessions.find((s) => s.id === activeSessionId) ?? null);

	let tab = $state<'cov' | 'his'>(untrack(() => (getPageState().tab === 'his' ? 'his' : 'cov')));
	let dim = $state<CoverageDim>(untrack(() => (getPageState().dim as CoverageDim) ?? 'BRAND'));
	let selected = $state<string[]>([]);

	function getPageState(): { tab: string | null; dim: string | null } {
		if (typeof window === 'undefined') return { tab: null, dim: null };
		const params = new SvelteURLSearchParams(window.location.search);
		return { tab: params.get('tab'), dim: params.get('dim') };
	}

	function syncUrlState(next: { tab?: string; dim?: string }): void {
		if (typeof window === 'undefined') return;
		const params = new SvelteURLSearchParams(window.location.search);
		if (next.tab) params.set('tab', next.tab);
		if (next.dim) params.set('dim', next.dim);
		window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
	}

	let showNew = $state(false);
	let showSettings = $state(false);
	let preloadScope = $state<{
		dim: 'ALL' | 'BRAND' | 'SUPPLIER' | 'TYPE';
		values: Tag[];
		quick: 'OLDEST' | 'NEVER' | null;
	} | null>(null);
	let config = $state<CountCycleConfig>(initialConfig);
	let isSubmitting = $state(false);

	const summary = $derived(coverageSnapshot.summary);
	const groups = $derived(coverageSnapshot.groups);
	const options = $derived(coverageSnapshot.options);

	function toggleRow(value: string): void {
		selected = selected.includes(value)
			? selected.filter((candidate) => candidate !== value)
			: [...selected, value];
	}

	function openQuick(quick: 'OLDEST' | 'NEVER'): void {
		preloadScope = { dim: 'ALL', values: [], quick };
		showNew = true;
	}

	function openSelection(): void {
		preloadScope = {
			dim,
			values: selected.map((value) => ({
				key: value,
				label: options[dim].find((option) => option.id === value)?.name ?? value
			})),
			quick: null
		};
		showNew = true;
	}

	function openEmpty(): void {
		preloadScope = { dim: 'ALL', values: [], quick: null };
		showNew = true;
	}

	async function createCount(scope: {
		quick?: 'OLDEST' | 'NEVER';
		n?: number;
		dim: 'ALL' | 'BRAND' | 'SUPPLIER' | 'TYPE';
		values: Tag[];
		responsibles: Tag[];
		responsibleExternal: string[];
		notes: string;
	}): Promise<boolean> {
		if (isSubmitting) return false;
		isSubmitting = true;
		try {
			const response = await createSessionCmd({
				dim: scope.dim,
				values: scope.values.map((tag) => tag.key),
				// Zod: z.enum().optional() y CoercedInteger.optional() aceptan undefined, no null.
				quick: scope.quick ?? undefined,
				n: scope.n ?? undefined,
				notes: scope.notes,
				responsibles: [
					...scope.responsibles.map((tag) => ({
						userId: scope.responsibles.some((r) => r.key === tag.key) ? tag.key : undefined,
						displayName: tag.label,
						isExternal: !scope.responsibles.some((r) => r.key === tag.key)
					}))
				]
			} as never);
			if (!response.success) {
				toast.error(response.error ?? 'No se pudo iniciar la sesión');
				return false;
			}
			const session = response.data;
			sessions = [session, ...sessions];
			sessionCountContext.activeSession = { id: session.id };
			showNew = false;
			toast.success(`Conteo #${session.id} en curso`);
			await goto(resolve(`/inventory/count/${session.id}`));
			return true;
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo iniciar la sesión'));
			return false;
		} finally {
			isSubmitting = false;
		}
	}

	async function onSettingsSave(next: CountCycleConfig): Promise<void> {
		const response = await saveCountSettings(next);
		if (!response.success) {
			toast.error(response.error);
			return;
		}
		config = response.data;
		showSettings = false;
		toast.success('Ajustes del ciclo guardados');
		await invalidate();
	}

	async function invalidate(): Promise<void> {
		// Re-fetch cobertura tras cambios de settings (recarga de datos).
		await goto(resolve('/inventory/count'), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function openSession(id: number): void {
		goto(resolve(`/inventory/count/${id}`));
	}
</script>

<svelte:head>
	<title>Conteo físico · Optikt</title>
</svelte:head>

<div class="mx-auto max-w-[1360px] space-y-3 p-4">
	<header class="flex flex-wrap items-center gap-3">
		<h1 class="font-heading text-2xl font-bold text-brand-navy sm:text-3xl">Conteo físico</h1>
		<CountTabs
			value={tab}
			options={[
				{
					value: 'cov',
					label: 'Cobertura',
					tooltip: 'Qué está verificado|Estado del inventario según los conteos cerrados.'
				},
				{
					value: 'his',
					label: 'Historial',
					tooltip: 'Conteos anteriores|Abre el informe de cualquier conteo.'
				}
			]}
			onchange={(value) => {
				tab = value as typeof tab;
				syncUrlState({ tab });
			}}
		/>
		<span class="flex-1"></span>

		{#if data.canManage}
			<TriggerTooltip
				title="Ajustes del ciclo"
				text="Plazo, semáforo, umbral de diferencia y atajo. Son globales."
				side="bottom"
			>
				{#snippet trigger({ props })}
					<button
						{...props}
						type="button"
						aria-label="Ajustes del ciclo"
						class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-brand-navy transition-colors hover:bg-surface-container-high"
						onclick={() => (showSettings = true)}
					>
						<Settings class="h-4 w-4" />
					</button>
				{/snippet}
			</TriggerTooltip>
		{/if}

		{#if activeSession}
			<CountButton variant="gold" onclick={() => openSession(activeSession.id)}>
				{#snippet child()}
					<Play class="h-4 w-4" />
					Continuar
				{/snippet}
			</CountButton>
		{:else}
			<CountButton variant="gold" onclick={openEmpty}>
				{#snippet child()}
					<Plus class="h-4 w-4" />
					Nuevo conteo
				{/snippet}
			</CountButton>
		{/if}
	</header>

	{#if activeSession && tab === 'cov'}
		<section
			class="flex flex-wrap items-center gap-2 rounded-lg bg-info-container px-4 py-2.5 text-sm font-medium text-on-info-container"
		>
			<b>Conteo #{activeSession.id} en curso</b>
			<span class="tabular-nums">{activeSession.verifiedLines}/{activeSession.totalLines}</span>
			<span>{activeSession.scopeLabel}</span>
		</section>
	{/if}

	{#if tab === 'cov'}
		<CycleCard
			{summary}
			cycleDays={config.cycleDays}
			quickOldestLimit={config.quickOldestLimit}
			onQuickOldest={() => openQuick('OLDEST')}
			onQuickNever={() => openQuick('NEVER')}
		/>
		<GroupsCoverageCard
			{dim}
			{groups}
			selectedValues={selected}
			onDimChange={(next: CoverageDim) => {
				dim = next;
				selected = [];
				syncUrlState({ dim: next });
			}}
			onToggleRow={toggleRow}
			onClearSelection={() => (selected = [])}
			onCountSelection={openSelection}
		/>
	{:else}
		<HistoryList {sessions} onOpenSession={openSession} />
	{/if}
</div>

<NewCountPanel
	bind:open={showNew}
	{options}
	coverageSummary={summary}
	{config}
	responsibleOptions={initialUsers.map((option) => ({
		userId: option.userId,
		displayName: option.displayName
	}))}
	preload={preloadScope}
	submitting={isSubmitting}
	onSubmit={createCount}
	onClose={() => (showNew = false)}
/>

{#if data.canManage}
	<CycleSettingsPanel
		bind:open={showSettings}
		{config}
		onClose={() => (showSettings = false)}
		onSave={onSettingsSave}
	/>
{/if}
