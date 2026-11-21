<script lang="ts">
	import { X } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import PersonsEditor from './PersonsEditor.svelte';
	import { primaryNote } from './primaryNote';
	import type { GroupItemView, UiGroup } from './groupsState';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** "#0313" / "P-0019" chip next to the title. */
		docLabel?: string;
		items: GroupItemView[];
		groups: UiGroup[];
		onchange: (groups: UiGroup[]) => void;
		showPrimary?: boolean;
		primaryLensId?: string | null;
		onprimarychange?: (lensId: string | null) => void;
		/** Detail "Organizar": persist on "Guardar". Without it the button just closes ("Listo"). */
		onsave?: () => void;
		saving?: boolean;
		/** Bottom sheet with 44px targets (mobile detail). */
		sheet?: boolean;
	}

	let {
		open = $bindable(),
		onclose,
		docLabel,
		items,
		groups,
		onchange,
		showPrimary = false,
		primaryLensId = null,
		onprimarychange,
		onsave,
		saving = false,
		sheet = false
	}: Props = $props();

	const note = $derived(
		showPrimary
			? primaryNote(items, groups, primaryLensId)
			: 'Agrupa cada ítem con la persona que lo usará. No cambia precios.'
	);
</script>

<SlideOver
	bind:open
	{onclose}
	direction={sheet ? 'bottom' : 'right'}
	dragClose={sheet}
	widthClass="w-full max-w-[600px]"
	bodyClass="bg-[#edf1f6] px-4 py-3.5 sm:px-[18px]"
>
	{#snippet header({ onclose: close })}
		<header
			class="relative flex items-start gap-3 overflow-hidden bg-brand-navy px-[18px] py-3.5 text-white"
		>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute -top-5 right-[90px] h-[120px] w-[18px] -skew-x-[25deg] bg-brand-gold"
			></span>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute -top-5 right-[60px] h-[120px] w-7 -skew-x-[25deg] bg-brand-blue"
			></span>
			<div class="relative z-[1] flex min-w-0 flex-1 flex-col gap-0.5">
				<h2 class="font-heading text-lg font-bold">
					Personas
					{#if docLabel}
						<span
							class="ml-1 rounded bg-brand-blue px-1.5 py-0.5 align-middle font-mono text-[11px]"
							>{docLabel}</span
						>
					{/if}
				</h2>
				<p class="text-xs text-[#b8c4de]">
					Agrupa cada ítem con la persona que lo usará. No cambia precios.
				</p>
			</div>
			<button
				type="button"
				onclick={close}
				aria-label="Cerrar"
				class="relative z-[1] inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#38466b] bg-[#1e2d55] sm:h-[34px] sm:w-[34px]"
			>
				<X class="h-4 w-4" />
			</button>
		</header>
	{/snippet}

	<PersonsEditor
		{items}
		{groups}
		{onchange}
		{showPrimary}
		{primaryLensId}
		{onprimarychange}
		touch={sheet}
	/>

	{#snippet footer()}
		<footer class="flex items-center gap-3 bg-brand-navy px-[18px] py-3 text-white">
			<p class="flex-1 text-xs text-[#d4eef8]">{note}</p>
			<button
				type="button"
				aria-disabled={saving}
				onclick={() => {
					if (saving) return;
					if (onsave) onsave();
					else onclose();
				}}
				class="h-11 rounded-lg bg-brand-gold px-4 font-bold text-brand-navy aria-disabled:opacity-60 sm:h-[38px]"
			>
				{onsave ? (saving ? 'Guardando…' : 'Guardar') : 'Listo'}
			</button>
		</footer>
	{/snippet}
</SlideOver>
