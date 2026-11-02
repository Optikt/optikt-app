<script lang="ts">
	import { CalendarDays, FileText, User } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleWithRelations;
		saleDate: string;
		notes: string;
		isCashea: boolean;
	}

	let {
		sale,
		saleDate = $bindable(),
		notes = $bindable(),
		isCashea = $bindable()
	}: Props = $props();

	const customerName = $derived(
		[sale.customer?.firstName, sale.customer?.lastName].filter(Boolean).join(' ') || 'Sin cliente'
	);

	const fieldClass = 'flex flex-col gap-[3px]';
	const labelClass =
		'text-[10px] font-bold tracking-[0.07em] text-slate-400 uppercase dark:text-slate-500';
	const inputWrapClass =
		'flex h-[34px] items-center gap-1.5 rounded-lg border border-outline-variant/70 bg-white px-2.5 transition focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800';
</script>

<div
	class="flex flex-wrap gap-2.5 border-b border-outline-variant/60 bg-surface-container-low px-5 py-2 dark:border-slate-700 dark:bg-slate-900/40"
>
	<div class={fieldClass}>
		<span class={labelClass}>Fecha</span>
		<div class={inputWrapClass}>
			<CalendarDays class="h-3.5 w-3.5 shrink-0 text-slate-400" />
			<input
				type="date"
				bind:value={saleDate}
				aria-label="Fecha de venta"
				class="w-[140px] border-none bg-transparent text-[13px] text-brand-navy outline-none dark:text-white"
			/>
		</div>
	</div>

	<div class="{fieldClass} min-w-[160px] flex-1">
		<span class={labelClass}>Cliente</span>
		<div class={inputWrapClass}>
			<User class="h-3.5 w-3.5 shrink-0 text-slate-400" />
			<span class="min-w-0 flex-1 truncate text-[13px] text-brand-navy dark:text-white">
				{customerName}
			</span>
			{#snippet casheaTrigger({ props }: { props: Record<string, unknown> })}
				<button
					{...props}
					type="button"
					onclick={() => (isCashea = !isCashea)}
					aria-pressed={isCashea}
					aria-label="Compra con Cashea"
					class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] text-[10px] font-extrabold transition {isCashea
						? 'bg-brand-gold text-brand-navy'
						: 'bg-surface-container-high text-slate-400 hover:bg-brand-gold/30'}"
				>
					C
				</button>
			{/snippet}
			<TriggerTooltip
				text={isCashea ? 'Compra con Cashea activada' : 'Marcar compra con Cashea'}
				trigger={casheaTrigger}
			/>
		</div>
	</div>

	<div class="{fieldClass} min-w-[160px] flex-1">
		<span class={labelClass}>Nota</span>
		<div class={inputWrapClass}>
			<FileText class="h-3.5 w-3.5 shrink-0 text-slate-400" />
			<input
				type="text"
				bind:value={notes}
				placeholder="Sin nota"
				aria-label="Nota de la venta"
				class="w-full border-none bg-transparent text-[13px] text-brand-navy outline-none placeholder:text-slate-400 dark:text-white"
			/>
		</div>
	</div>
</div>
