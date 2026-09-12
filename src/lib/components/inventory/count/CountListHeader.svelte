<script lang="ts">
	import { Play, Plus } from '@lucide/svelte';
	import { formatInventoryCountScope } from '$lib/schemas/inventoryCount';
	import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';

	interface Props {
		recentlyAppliedCount: number;
		totalAuditedItems: number;
		activeSession: InventoryCountSessionSummary | null;
		onContinue: () => void;
		onCreate: () => void;
	}

	let { recentlyAppliedCount, totalAuditedItems, activeSession, onContinue, onCreate }: Props =
		$props();
</script>

<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
	<div class="min-w-0">
		<h1 class="font-heading text-2xl font-bold tracking-[-0.03em] text-brand-navy sm:text-3xl">
			Conteo Físico
		</h1>
		<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
			<span>Historial y gestión de sesiones de inventario</span>
			<span class="hidden text-outline sm:inline">•</span>
			<span>Últimas 2 semanas: {recentlyAppliedCount} sesiones</span>
			<span class="hidden text-outline sm:inline">•</span>
			<span>Cobertura acumulada: {totalAuditedItems} ítems</span>
		</div>
	</div>

	<div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
		{#if activeSession}
			<button
				type="button"
				onclick={onContinue}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
			>
				<Play class="h-4 w-4" />
				Continuar sesión
			</button>
		{:else}
			<button
				type="button"
				onclick={onCreate}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-gold-dark"
			>
				<Plus class="h-4 w-4" />
				Nueva sesión
			</button>
		{/if}
	</div>
</div>

<section
	class="glass-card border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 shadow-sm"
>
	<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex min-w-0 items-center gap-2 text-sm">
			<span
				class={`h-2.5 w-2.5 rounded-full ${activeSession ? 'bg-warning' : 'bg-success'}`}
				aria-hidden="true"
			></span>
			<p class="truncate font-semibold text-brand-navy">
				{activeSession ? `Sesión #${activeSession.id} en progreso` : 'Sin sesión activa'}
			</p>
		</div>

		{#if activeSession}
			<div class="flex flex-wrap gap-2">
				<span
					class="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-brand-navy"
				>
					{formatInventoryCountScope(activeSession.scopeType, activeSession.scopeValue)}
				</span>
				<span
					class="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant"
				>
					{activeSession.pendingLines} pendientes
				</span>
			</div>
		{:else}
			<p class="text-xs font-medium text-on-surface-variant">
				Sin bloqueos activos; usa el historial para revisar sesiones previas.
			</p>
		{/if}
	</div>
</section>
