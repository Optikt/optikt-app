<script lang="ts">
	import type { Snippet } from 'svelte';

	type Size = 'md' | 'lg' | 'xl';
	type Direction = 'right' | 'bottom';

	let {
		open = $bindable(false),
		onclose,
		closeGuard,
		size = 'lg' as Size,
		widthClass,
		direction = 'right' as Direction,
		/** Solo `direction="bottom"`: cierra arrastrando el asa hacia abajo (> 90 px). */
		dragClose = false,
		/** Opt-in: tocar el velo cierra (hojas móviles). Los drawers con formulario lo dejan en false. */
		closeOnVeil = false,
		bodyClass = 'px-6 py-4',
		/** Intercept Escape inside the drawer: return true when an inner view
		 *  (editor / combobox) consumed the key so the drawer stays open. */
		escapeHandler,
		children,
		header,
		footer
	}: {
		open?: boolean;
		onclose?: () => void;
		/** Return false to block closing (e.g. unsaved changes). */
		closeGuard?: () => boolean;
		size?: Size;
		/** Overrides the size width (e.g. `w-full lg:w-[min(94vw,1280px)]`). */
		widthClass?: string;
		direction?: Direction;
		/** Solo bottom: cierra arrastrando el asa hacia abajo (> 90 px). */
		dragClose?: boolean;
		/** Opt-in: tocar el velo cierra (default false: drawers con formulario). */
		closeOnVeil?: boolean;
		/** Classes for the scrollable body (default `px-6 py-4`). */
		bodyClass?: string;
		/** Return true when Escape was consumed by an inner view. */
		escapeHandler?: () => boolean;
		children: Snippet;
		header?: Snippet<[{ onclose: () => void }]>;
		footer?: Snippet;
	} = $props();

	const maxWidth = {
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-2xl'
	} as const;

	let panel: HTMLDivElement | undefined = $state();

	function handleClose() {
		if (closeGuard && !closeGuard()) return;
		open = false;
		onclose?.();
	}

	/** Drag-to-close del asa (bottom): > 90 px cierra; menos, vuelve con animación. */
	function handleGrabDown(event: PointerEvent): void {
		if (!dragClose || direction !== 'bottom' || !panel) return;
		const el = panel;
		const startY = event.clientY;
		let dy = 0;
		el.style.transition = 'none';
		try {
			el.setPointerCapture(event.pointerId);
		} catch {
			// Navegador sin pointer capture: los listeners de window cubren el gesto igual.
		}

		const finish = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onCancel);
			el.style.transition = '';
			el.style.transform = '';
			if (dy > 90) handleClose();
		};
		const onMove = (moveEvent: PointerEvent) => {
			dy = Math.max(0, moveEvent.clientY - startY);
			el.style.transform = `translateY(${dy}px)`;
		};
		const onUp = () => finish();
		// El navegador puede cancelar el gesto (scroll del sistema, llamada, etc.):
		// soltar el panel tal cual, sin cerrar.
		const onCancel = () => {
			dy = 0;
			finish();
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
	}

	$effect(() => {
		if (!open) return;
		panel?.focus();

		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== 'Escape') return;
			if (escapeHandler?.()) {
				e.preventDefault();
				return;
			}
			handleClose();
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<div
	class="fixed inset-0 z-54 bg-black/50 transition-opacity duration-300 ease-in-out"
	class:opacity-0={!open}
	class:pointer-events-none={!open}
	role="presentation"
	onclick={closeOnVeil ? handleClose : undefined}
></div>

{#if direction === 'bottom'}
	<div
		bind:this={panel}
		class="fixed inset-x-0 bottom-0 z-55 flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-surface-container-lowest pb-[env(safe-area-inset-bottom,0px)] shadow-2xl transition-transform duration-300 ease-in-out outline-none"
		class:translate-y-full={!open}
		class:translate-y-0={open}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- El asa es un extra: siempre hay botón de cierre (veil/✕/Esc). -->
		<div
			class="mx-auto w-full shrink-0 {dragClose
				? 'cursor-grab touch-none px-6 pt-2.5 pb-1'
				: 'pt-2.5 pb-1'}"
			onpointerdown={dragClose ? handleGrabDown : undefined}
			aria-hidden="true"
		>
			<div class="mx-auto h-1.5 w-10 rounded-full bg-outline/30"></div>
		</div>
		{#if header}
			{@render header({ onclose: handleClose })}
		{/if}
		<div class="flex-1 overflow-y-auto {bodyClass}">
			{@render children()}
		</div>
		{#if footer}
			{@render footer()}
		{/if}
	</div>
{:else}
	<div
		bind:this={panel}
		class="fixed top-0 right-0 z-55 flex h-full flex-col bg-surface-container-lowest shadow-2xl transition-transform duration-300 ease-in-out outline-none {widthClass ??
			`w-full ${maxWidth[size]}`}"
		class:translate-x-full={!open}
		class:translate-x-0={open}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		{#if header}
			{@render header({ onclose: handleClose })}
		{/if}
		<div class="flex-1 overflow-y-auto {bodyClass}">
			{@render children()}
		</div>
		{#if footer}
			{@render footer()}
		{/if}
	</div>
{/if}
