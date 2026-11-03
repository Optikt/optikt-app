<script lang="ts">
	import { CalendarDays, MessageSquareText } from '@lucide/svelte';

	interface Props {
		saleDate: string;
		notes: string;
	}

	let { saleDate = $bindable(), notes = $bindable() }: Props = $props();

	let editing = $state(false);

	const displayDate = $derived(saleDate.split('-').reverse().join('/'));
</script>

<!-- Meta bar (only in list view): collapsed shows date + note; "Editar" expands inline -->
<div
	class="flex min-h-[44px] items-center gap-3.5 bg-surface-drawer-strip px-5 text-[13px] text-on-surface-variant"
>
	{#if editing}
		<input
			type="date"
			bind:value={saleDate}
			aria-label="Fecha de venta"
			class="h-8 rounded-lg border border-outline-variant bg-white px-2 text-[13px] text-brand-navy outline-offset-[-1px] outline-none focus:outline-2 focus:outline-brand-blue"
		/>
		<input
			type="text"
			bind:value={notes}
			placeholder="Nota"
			aria-label="Nota de la venta"
			class="h-8 min-w-0 flex-1 rounded-lg border border-outline-variant bg-white px-2 text-[13px] text-brand-navy outline-offset-[-1px] outline-none placeholder:text-slate-400 focus:outline-2 focus:outline-brand-blue"
		/>
		<button
			type="button"
			onclick={() => (editing = false)}
			class="font-semibold text-brand-navy underline underline-offset-[3px] transition hover:text-brand-navy-dark"
		>
			Listo
		</button>
	{:else}
		<span class="flex items-center gap-1.5 font-medium text-brand-navy" data-testid="meta-date">
			<CalendarDays class="h-3.5 w-3.5 text-on-surface-variant" />
			{displayDate}
		</span>
		<span class="flex min-w-0 items-center gap-1.5 truncate font-medium text-brand-navy">
			<MessageSquareText class="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
			<span class="truncate">{notes || 'Sin nota'}</span>
		</span>
		<button
			type="button"
			onclick={() => {
				editing = true;
			}}
			class="ml-auto font-semibold text-brand-navy underline underline-offset-[3px] transition hover:text-brand-navy-dark"
		>
			Editar
		</button>
	{/if}
</div>
