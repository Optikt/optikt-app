/**
 * Estado y acciones de «Actualizar datos» en la pantalla de sesión de conteo:
 * un solo botón que (1) trae el estado vigente y (2) re-sincroniza la
 * referencia cuando el stock vivo difiere del snapshot. Vive en un
 * `.svelte.ts` para que el estado reactivo ($state) y las acciones viajen
 * juntos sin inflar `+page.svelte` (size gate DT1) — mismo criterio que
 * `paymentFormModel.svelte.ts`.
 *
 * - `refreshData()`: lee el plan del refresh (1 query). Si el stock NO cambió
 *   → `reload()` y avisa (el «F5» de siempre). Si cambió → abre el modal, que
 *   muestra cuántas líneas se actualizarán, cuántas pierden su conteo y
 *   cuántas quedan intactas.
 * - `reload()`: trae sesión + líneas + responsables + costos pendientes sin
 *   salir de la página. No escribe nada.
 * - `confirm()`: ejecuta la re-sincronización (escribe `system_stock`) y
 *   recarga al terminar.
 */
import { toast } from 'svelte-sonner';

import {
	getSessionById,
	refreshStockCmd,
	refreshStockPreview
} from '$lib/remote/inventoryCount.remote';
import type { StockRefreshPreview } from '$lib/server/db/queries/inventoryCount/refresh';
import type { InventoryCountSessionDetail } from '$lib/server/db/queries/inventoryCount/types';
import { getErrorMessage } from '$lib/utils';
import { logger } from '$lib/utils/logger';

interface CountRefreshModelOptions {
	/** Id de la sesión (getter: el objeto de sesión puede recargarse). */
	sessionId: () => number;
	/** Aplica el detalle recargado al estado de la página (session/lines/responsibles). */
	applyDetail: (detail: InventoryCountSessionDetail) => void;
	/** Pide costos FIFO si alguna línea recargada los necesita. */
	maybeRefreshCosts: (detail: InventoryCountSessionDetail) => void;
	/**
	 * Líneas que perdieron su conteo al refrescar stock. La página usa esto
	 * para volver a la fase 1: si hay que recontar, Revisar ya no es el lugar.
	 */
	onCleared?: (clearedCounts: number) => void;
}

export function createCountRefreshModel(options: CountRefreshModelOptions) {
	const { sessionId, applyDetail, maybeRefreshCosts, onCleared } = options;

	let preview = $state<StockRefreshPreview | null>(null);
	let modal = $state(false);
	let busy = $state(false);
	let reloading = $state(false);

	/**
	 * Recarga sesión + líneas + responsables + costos pendientes. Es el
	 * «F5 del contenido»: no escribe nada. Lanza si no se pudo cargar.
	 */
	async function reload(): Promise<void> {
		if (reloading) return;
		reloading = true;
		try {
			const detail = await getSessionById({ id: sessionId() });
			if (!detail) throw new Error('No se pudo recargar la sesión');
			applyDetail(detail);
			maybeRefreshCosts(detail);
		} finally {
			reloading = false;
		}
	}

	/**
	 * «Actualizar datos»: un solo botón que pone la pantalla al día.
	 * 1. Lee el plan del refresh de stock (1 query).
	 * 2. Si el stock NO cambió → recarga la vista y avisa (era el «F5»).
	 * 3. Si cambió → abre el modal: ahí se ve cuántas líneas se actualizarán
	 *    y cuántas pierden su conteo (acción con consecuencias).
	 */
	async function refreshData(): Promise<void> {
		if (busy) return;
		busy = true;
		preview = null;
		try {
			const result = await refreshStockPreview({ id: sessionId() });
			if (result.updatedLines === 0) {
				// Nada que re-sincronizar: solo recarga (ventas/contajes de otros).
				await reload();
				toast.info('Datos al día');
				return;
			}
			preview = result;
			modal = true;
		} catch (error) {
			logger.error('No se pudo actualizar la sesión', error);
			toast.error(getErrorMessage(error, 'No se pudo actualizar la sesión'));
		} finally {
			busy = false;
		}
	}

	/** Ejecuta el refresh de stock ya confirmado (el modal se cierra al aceptar). */
	async function confirm(): Promise<void> {
		if (busy) return;
		busy = true;
		modal = false;
		try {
			const response = await refreshStockCmd({ id: sessionId() });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			const { updatedLines, clearedCounts } = response.data;
			onCleared?.(clearedCounts);
			toast.success(
				clearedCounts > 0
					? `Stock refrescado: ${updatedLines} línea(s) actualizada(s) · ${clearedCounts} quedaron sin conteo (recontar)`
					: `Stock refrescado: ${updatedLines} línea(s) actualizada(s)`
			);
		} catch (error) {
			logger.error('No se pudo refrescar el stock', error);
			toast.error(getErrorMessage(error, 'No se pudo refrescar el stock'));
		} finally {
			// Recarga aparte: si falla (red), el server ya quedó actualizado y
			// no debe reportarse como «no se pudo refrescar».
			try {
				await reload();
			} catch (error) {
				logger.error('No se pudieron recargar las líneas tras el refresh', error);
				toast.error('Stock refrescado, pero no se pudieron recargar las líneas');
			}
			busy = false;
		}
	}

	return {
		get preview(): StockRefreshPreview | null {
			return preview;
		},
		get modal(): boolean {
			return modal;
		},
		set modal(value: boolean) {
			modal = value;
		},
		get busy(): boolean {
			return busy;
		},
		get reloading(): boolean {
			return reloading;
		},
		/** true mientras el botón hace cualquier cosa (recarga, preview o escritura). */
		get working(): boolean {
			return busy || reloading;
		},
		refreshData,
		reload,
		confirm
	};
}
