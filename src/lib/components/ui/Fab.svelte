<script lang="ts" generics="IconComponent extends Component<{ class?: string }>">
	import type { Component } from 'svelte';
	import { Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { getAppMainScroll } from '$lib/utils/scroll';

	/**
	 * FAB extendido (patrón móvil del kit).
	 * Extendido con su label cuando la lista está arriba; al bajar > 60 px se
	 * contrae a solo el icono; al bajar rápido se oculta (se desliza hacia
	 * abajo) y reaparece al subir. Transiciones de 250 ms — `prefers-reduced-motion`
	 * las desactiva con la regla global del repo.
	 *
	 * Debe montarse FUERA de cualquier contenedor con `container-type`
	 * (`fixed` + containment son incompatibles, mismo motivo que la barra móvil del detalle).
	 * `href` es la RUTA CRUDA del kit (`'/sales/new'`): este componente la resuelve una vez.
	 */
	interface Props {
		label: string;
		/** Destino (enlace); sin `href` usa `onclick` (botón). */
		href?: string;
		onclick?: () => void;
		icon?: IconComponent;
		/** Gate externo (permisos, p. ej. VIEWER). */
		hidden?: boolean;
		class?: string;
	}

	let {
		label,
		href,
		onclick,
		icon: Icon = Plus as IconComponent,
		hidden = false,
		class: className = ''
	}: Props = $props();

	let el = $state<HTMLElement | undefined>(undefined);
	let extended = $state(true);
	let hiddenByScroll = $state(false);
	let lastY = 0;

	function onScroll(): void {
		const y = getAppMainScroll()?.scrollTop ?? window.scrollY;
		extended = y < 60;
		if (y > lastY + 6 && y > 160) hiddenByScroll = true;
		else if (y < lastY - 6) hiddenByScroll = false;
		lastY = y;
	}

	// El contenedor de scroll es el <main> del layout (fallback: window).
	$effect(() => {
		const node = el;
		if (!node) return;
		const target: HTMLElement | Window = getAppMainScroll() ?? window;
		target.addEventListener('scroll', onScroll, { passive: true });
		return () => target.removeEventListener('scroll', onScroll);
	});

	const base =
		'fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-brand-gold text-brand-navy shadow-[0_4px_14px_rgba(21,35,70,0.3),0_1px_3px_rgba(21,35,70,0.2)] transition-all duration-250 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none';
</script>

{#snippet content()}
	<Icon class="h-6 w-6 shrink-0" />
	<span
		class="overflow-hidden text-[15px] font-bold whitespace-nowrap transition-all duration-250 {extended
			? 'max-w-40'
			: 'max-w-0'}"
	>
		{label}
	</span>
{/snippet}

{#if !hidden}
	{#if href}
		<a
			bind:this={el}
			href={resolve(href as '/')}
			aria-label={label}
			class="{base} {extended ? 'w-auto px-5' : 'w-14'} {hiddenByScroll
				? 'pointer-events-none translate-y-[120px]'
				: 'translate-y-0'} {className}"
		>
			{@render content()}
		</a>
	{:else}
		<button
			bind:this={el}
			type="button"
			{onclick}
			aria-label={label}
			class="{base} {extended ? 'w-auto px-5' : 'w-14'} {hiddenByScroll
				? 'pointer-events-none translate-y-[120px]'
				: 'translate-y-0'} {className}"
		>
			{@render content()}
		</button>
	{/if}
{/if}
