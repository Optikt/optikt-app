<script lang="ts">
	import { auditDiffRows, hasAuditDetail, type AuditEvent } from '$lib/utils/saleDetail';
	import { formatDate } from '$lib/utils';

	interface Props {
		event: AuditEvent;
		/** Compact spacing for the overview card (drawer uses the default). */
		dense?: boolean;
	}

	let { event, dense = false }: Props = $props();

	let open = $state(false);

	const rows = $derived(auditDiffRows(event));
	const showToggle = $derived(rows.length > 0);
	const detail = $derived(hasAuditDetail(event));

	function dotClass(kind: AuditEvent['kind']): string {
		if (kind === 'create') return 'bg-brand-navy';
		if (kind === 'status') return 'bg-brand-blue';
		if (kind === 'cancel') return 'bg-error';
		return 'bg-outline-variant';
	}
</script>

<div class="relative {dense ? 'py-1.5 pr-2 pl-10' : 'py-2 pr-4 pl-10'}">
	<!-- Continuous timeline line behind the dot -->
	<span class="absolute top-0 bottom-0 left-5 w-0.5 bg-outline-variant/60"></span>
	<span
		class="absolute top-2.5 left-[15px] h-3 w-3 rounded-full border-2 border-white {dotClass(
			event.kind
		)}"
	></span>

	<p class="text-[13px] leading-snug font-semibold text-on-surface">{event.label}</p>
	<p class="mt-0.5 text-xs text-on-surface-variant">
		{event.changedByName ?? 'Usuario desconocido'} · {formatDate(event.changedAt, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})}
	</p>

	{#if detail}
		{#if showToggle}
			<button
				type="button"
				onclick={() => (open = !open)}
				class="mt-1 text-xs font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
			>
				{open ? 'Ocultar' : 'Ver'} cambios
			</button>
		{:else if event.reason}
			<p class="mt-1 text-xs text-on-surface-variant">Motivo: {event.reason}</p>
		{/if}
	{/if}

	{#if showToggle}
		<div
			class="grid transition-[grid-template-rows] duration-[250ms] ease-out {open
				? 'grid-rows-[1fr]'
				: 'grid-rows-[0fr]'}"
		>
			<div class="overflow-hidden">
				<ul class="mt-1.5 mb-1 space-y-1 rounded-lg bg-surface-container-low px-3 py-2 text-xs">
					{#if event.reason}
						<li class="font-semibold text-on-surface">Motivo: {event.reason}</li>
					{/if}
					{#each rows as row (row.field)}
						<li class="text-on-surface-variant">
							<span class="font-semibold text-on-surface">{row.label}:</span>
							{row.from} → {row.to}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</div>
