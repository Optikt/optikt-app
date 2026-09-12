<script lang="ts">
	import { Boxes, CheckCircle2, ClipboardList, Clock3 } from '@lucide/svelte';

	interface Props {
		totalSessions: number;
		openSessionsCount: number;
		recentlyAppliedCount: number;
		totalAuditedItems: number;
		hasActiveSession: boolean;
	}

	let {
		totalSessions,
		openSessionsCount,
		recentlyAppliedCount,
		totalAuditedItems,
		hasActiveSession
	}: Props = $props();
</script>

<section class="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
	<div
		class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
	>
		<div class="space-y-1">
			<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
				Sesiones totales
			</p>
			<p class="text-2xl font-semibold text-brand-navy">{totalSessions}</p>
			<p class="text-xs text-on-surface-variant">historial cargado en pantalla</p>
		</div>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container text-brand-navy"
		>
			<ClipboardList class="h-4.5 w-4.5" />
		</div>
	</div>

	<div
		class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
	>
		<div class="space-y-1">
			<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
				Sesiones abiertas
			</p>
			<p class="text-2xl font-semibold text-brand-navy">{openSessionsCount}</p>
			<p class="text-xs text-on-surface-variant">
				{#if hasActiveSession}requieren atención inmediata{:else}sin bloqueos activos{/if}
			</p>
		</div>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning-container/60 text-on-warning-container"
		>
			<Clock3 class="h-4.5 w-4.5" />
		</div>
	</div>

	<div
		class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
	>
		<div class="space-y-1">
			<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
				Aplicadas recientes
			</p>
			<p class="text-2xl font-semibold text-brand-navy">{recentlyAppliedCount}</p>
			<p class="text-xs text-on-surface-variant">últimos 14 días</p>
		</div>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-2xl bg-success-container/60 text-success"
		>
			<CheckCircle2 class="h-4.5 w-4.5" />
		</div>
	</div>

	<div
		class="glass-card flex h-full items-center justify-between gap-3 border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md"
	>
		<div class="space-y-1">
			<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
				Ítems auditados
			</p>
			<p class="text-2xl font-semibold text-brand-navy">{totalAuditedItems}</p>
			<p class="text-xs text-on-surface-variant">conteos registrados en historial</p>
		</div>
		<div
			class="flex h-10 w-10 items-center justify-center rounded-2xl bg-info-container/60 text-brand-blue"
		>
			<Boxes class="h-4.5 w-4.5" />
		</div>
	</div>
</section>
