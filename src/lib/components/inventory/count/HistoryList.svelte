<script lang="ts">
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import AppBadge from '$lib/components/ui/badges/AppBadge.svelte';
	import { statusLabelFor, statusVariantFor } from '$lib/shared/inventoryCount';
	import type { CountSessionSummary } from '$lib/server/db/queries/inventoryCount/types';

	interface Props {
		sessions: CountSessionSummary[];
		onOpenSession: (id: number) => void;
	}

	let { sessions, onOpenSession }: Props = $props();
</script>

<section class="rounded-xl bg-white p-3.5 shadow-[var(--ds-shadow-md)]">
	{#if sessions.length === 0}
		<EmptyState message="Sin conteos registrados todavía" />
	{:else}
		<div class="divide-y divide-outline-variant/40">
			{#each sessions as session (session.id)}
				<button
					type="button"
					class="flex w-full flex-wrap items-center gap-2.5 px-3 py-3 text-left text-sm transition-colors hover:bg-surface-container-low"
					onclick={() => onOpenSession(session.id)}
				>
					<b class="min-w-[92px] text-brand-navy">Conteo #{session.id}</b>
					<span class="flex-1 text-on-surface-variant">{session.scopeLabel}</span>
					<AppBadge variant={statusVariantFor(session.status)}
						>{statusLabelFor(session.status)}</AppBadge
					>
					<span class="text-xs text-on-surface-variant tabular-nums">
						{new Date(session.appliedAt ?? session.openedAt).toLocaleDateString()}
					</span>
					<span class="text-xs text-on-surface-variant tabular-nums">
						+{session.positiveDifferences} / −{session.negativeDifferences} / OK {session.matchedLines}
					</span>
					<span class="font-semibold text-[#1e4f5e]">Ver informe →</span>
				</button>
			{/each}
		</div>
	{/if}
</section>
