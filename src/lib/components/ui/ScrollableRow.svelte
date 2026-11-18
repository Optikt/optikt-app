<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Fila de píldoras desplazable (patrón móvil del kit).
	 * Una sola línea con scroll horizontal (sin barra), máscara de desvanecimiento
	 * en el borde derecho cuando hay más contenido, y re-alineación del hijo
	 * marcado con `data-active` cuando cambia `activeKey`.
	 * La posición del scroll se conserva entre re-renders (el contenedor no se recrea).
	 */
	interface Props {
		children: Snippet;
		/** Cambia cuando debe re-alinearse al hijo activo (`[data-active]`). */
		activeKey?: string;
		/** Rol del contenedor (p. ej. `group` para una fila de filtros). */
		role?: string;
		ariaLabel?: string;
		class?: string;
	}

	let {
		children,
		activeKey = '',
		role = undefined,
		ariaLabel = '',
		class: className = ''
	}: Props = $props();

	let scroller: HTMLDivElement | undefined = $state();
	let canScroll = $state(false);

	function updateCanScroll(): void {
		const el = scroller;
		if (!el) return;
		canScroll = el.scrollWidth > el.clientWidth + 1;
	}

	function alignActive(): void {
		const el = scroller;
		if (!el) return;
		const active = el.querySelector<HTMLElement>('[data-active]');
		if (active) {
			active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		}
	}

	$effect(() => {
		// Re-alinear cuando cambia el activo o se re-renderizan los hijos.
		void activeKey;
		void children;
		alignActive();
		updateCanScroll();
	});

	// Re-evaluar "¿hay más contenido?" al cambiar el tamaño.
	$effect(() => {
		const el = scroller;
		if (!el) return;
		const observer = new ResizeObserver(() => updateCanScroll());
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<div
	bind:this={scroller}
	{role}
	aria-label={ariaLabel || undefined}
	class="flex w-full items-center overflow-x-auto [&::-webkit-scrollbar]:hidden {className}"
	style:scrollbar-width="none"
	style:mask-image={canScroll
		? 'linear-gradient(90deg, black calc(100% - 28px), transparent)'
		: undefined}
	style:-webkit-mask-image={canScroll
		? 'linear-gradient(90deg, black calc(100% - 28px), transparent)'
		: undefined}
>
	{@render children()}
</div>
