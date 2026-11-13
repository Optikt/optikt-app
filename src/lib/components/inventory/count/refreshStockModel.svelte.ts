/**
 * Estado y acciones de «Refrescar stock» (pantalla de sesión). Vive en un
 * `.svelte.ts` para que el estado reactivo ($state) y las acciones viajen
 * juntos sin inflar `+page.svelte` (size gate DT1) — mismo criterio que
 * `paymentFormModel.svelte.ts`.
 *
 * El preview corre ANTES de abrir el modal: el usuario ve cuántas líneas
 * cambiarán, cuántas pierden su conteo y cuántas quedan intactas, antes de
 * confirmar. Si nada cambió, no hay nada que confirmar.
 */
import { toast } from 'svelte-sonner';

import { refreshStockCmd, refreshStockPreview } from '$lib/remote/inventoryCount.remote';
import type { StockRefreshPreview } from '$lib/server/db/queries/inventoryCount/refresh';
import { getErrorMessage } from '$lib/utils';
import { logger } from '$lib/utils/logger';

interface RefreshStockModelOptions {
	/** Id de la sesión (getter: el objeto de sesión puede recargarse). */
	sessionId: () => number;
	/** Recarga líneas y costos tras ejecutar el refresh. */
	refreshLines: () => Promise<void>;
	/**
	 * Líneas que perdieron su conteo al refrescar. La página usa esto para
	 * volver a la fase 1: si hay que recontar, Revisar ya no es el lugar.
	 */
	onCleared?: (clearedCounts: number) => void;
}

export function createRefreshStockModel(options: RefreshStockModelOptions) {
	const { sessionId, refreshLines, onCleared } = options;

	let preview = $state<StockRefreshPreview | null>(null);
	let modal = $state(false);
	let busy = $state(false);

	/** Calcula el preview y abre el modal (o avisa que todo está al día). */
	async function openPreview(): Promise<void> {
		if (busy) return;
		busy = true;
		preview = null;
		try {
			const result = await refreshStockPreview({ id: sessionId() });
			if (result.updatedLines === 0) {
				toast.info('El stock ya está al día: ninguna línea cambió');
				return;
			}
			preview = result;
			modal = true;
		} catch (error) {
			logger.error('No se pudo calcular el refresco de stock', error);
			toast.error(getErrorMessage(error, 'No se pudo calcular el refresco de stock'));
		} finally {
			busy = false;
		}
	}

	/** Ejecuta el refresh ya confirmado (el modal se cierra al aceptar). */
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
				await refreshLines();
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
		openPreview,
		confirm
	};
}
