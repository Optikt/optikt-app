<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Carrusel horizontal con scroll-snap (patrón móvil del kit).
	 * Se extiende de borde a borde de la pantalla (margen negativo igual al
	 * padding de la página) pero la primera tarjeta arranca alineada con el
	 * contenido: `scroll-padding-inline` = `edgePx`. La siguiente tarjeta asoma
	 * para invitar a deslizar; indicador de puntos que sigue al scroll.
	 */
	interface Props {
		/** Items a renderizar (define también el número de puntos del indicador). */
		items: readonly unknown[];
		/** Snippet por item: `(item, index)`. */
		item: Snippet<[unknown, number]>;
		/** Ancho fijo de cada tarjeta (px). */
		itemWidthPx: number;
		/** Gap entre tarjetas (px, default 10). */
		gapPx?: number;
		/** Margen lateral visible y snap (px, default 12): igual al padding de la página. */
		edgePx?: number;
		ariaLabel?: string;
	}

	let { items, item, itemWidthPx, gapPx = 10, edgePx = 12, ariaLabel = '' }: Props = $props();

	let scroller: HTMLDivElement | undefined = $state();
	let active = $state(0);

	const step = $derived(itemWidthPx + gapPx);

	function onScroll(): void {
		const el = scroller;
		if (!el) return;
		const idx = Math.round(el.scrollLeft / step);
		active = Math.min(items.length - 1, Math.max(0, idx));
	}

	// Reset del indicador si cambia la cantidad de items.
	$effect(() => {
		void items;
		active = 0;
		if (scroller) scroller.scrollTo({ left: 0 });
	});
</script>

<div>
	<div
		bind:this={scroller}
		onscroll={onScroll}
		role="group"
		aria-label={ariaLabel}
		class="flex items-stretch [&::-webkit-scrollbar]:hidden"
		style:gap="{gapPx}px"
		style:overflow-x="auto"
		style:scroll-snap-type="x mandatory"
		style:scroll-padding-inline="{edgePx}px"
		style:margin-inline="-{edgePx}px"
		style:padding="2px {edgePx}px 4px"
		style:scrollbar-width="none"
		style:-ms-overflow-style="none"
	>
		{#each items as entry, index (index)}
			<div class="shrink-0" style:flex="0 0 {itemWidthPx}px" style:scroll-snap-align="start">
				{@render item(entry, index)}
			</div>
		{/each}
		<!-- Espacio después de la última tarjeta para que el snap no la pegue al borde. -->
		<div aria-hidden="true" style:flex="0 0 {edgePx}px"></div>
	</div>

	{#if items.length > 1}
		<div class="mt-1.5 flex justify-center gap-1.5" aria-hidden="true">
			{#each items as _, index (index)}
				<span
					class="h-1.5 rounded-full transition-all duration-200 {index === active
						? 'w-[18px] bg-brand-navy'
						: 'w-1.5 bg-outline-variant/70'}"
				></span>
			{/each}
		</div>
	{/if}
</div>
