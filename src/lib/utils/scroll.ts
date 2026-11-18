/**
 * Contenedor de scroll de la app (el `<main>` del layout) — el FAB y el
 * scroll-to-top de la paginación asumen este único contenedor.
 */
export function getAppMainScroll(): HTMLElement | null {
	if (typeof document === 'undefined') return null;
	return document.querySelector<HTMLElement>('main');
}
