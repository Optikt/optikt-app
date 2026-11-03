<script lang="ts">
	import { ArrowLeft, Check, Pencil } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		title: string;
		isNew: boolean;
		onBack: () => void;
		onDone: () => void;
	}

	let { title, isNew, onBack, onDone }: Props = $props();
</script>

<div class="sticky top-0 z-[2] flex items-center gap-2.5 bg-brand-blue px-4 py-2.5 text-brand-navy">
	{#snippet backTrigger({ props }: { props: Record<string, unknown> })}
		<button
			{...props}
			type="button"
			onclick={onBack}
			class="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-semibold text-brand-navy transition hover:bg-white/85"
		>
			<ArrowLeft class="h-[15px] w-[15px]" /> Artículos
		</button>
	{/snippet}
	<TriggerTooltip text="Descartar este borrador y volver" side="bottom" trigger={backTrigger} />

	<span
		class="inline-flex items-center gap-1.5 rounded-[4px] bg-brand-navy px-2 py-1 text-[11px] font-bold tracking-[0.08em] text-white uppercase"
	>
		<Pencil class="h-3 w-3" /> Editando
	</span>

	<h3 class="font-heading min-w-0 flex-1 truncate text-[16px] font-bold text-brand-navy">
		{title}{isNew ? ' · nuevo' : ''}
	</h3>

	{#snippet doneTrigger({ props }: { props: Record<string, unknown> })}
		<button
			{...props}
			type="button"
			onclick={onDone}
			class="flex h-9 items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-navy-dark"
		>
			Hecho <Check class="h-[15px] w-[15px]" />
		</button>
	{/snippet}
	<TriggerTooltip
		text="Aplica los cambios a la orden. Aún no se guarda"
		side="bottom"
		trigger={doneTrigger}
	/>
</div>
