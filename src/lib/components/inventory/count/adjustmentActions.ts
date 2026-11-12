/**
 * Acciones de ajuste de la fase Revisar (pantalla de sesión): solicitar,
 * solicitar en lote y quitar. Viven fuera de `+page.svelte` para mantenerla
 * bajo el size gate DT1; la página aporta el estado (líneas, motivo, busy)
 * y la reactividad sigue siendo suya ($state).
 */
import { toast } from 'svelte-sonner';

import {
	clearLineAdjustmentCmd,
	requestAdjustmentsBatchCmd,
	requestLineAdjustmentCmd
} from '$lib/remote/inventoryCount.remote';
import type { CountLineRow } from '$lib/server/db/queries/inventoryCount/types';
import { ADJUSTMENT_REASON_LABELS, AdjustmentReason } from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';
import { logger } from '$lib/utils/logger';

interface AdjustmentActionsOptions {
	/** Sesión de la fase (para el lote). */
	sessionId: number;
	/** Motivo actual del drawer de ajuste. */
	getReason: () => { reason: AdjustmentReason; reasonText: string };
	/** Reemplaza una línea actualizada en el estado de la página. */
	replaceLine: (line: CountLineRow) => void;
	/** Recarga todas las líneas desde el servidor. */
	refreshLines: () => Promise<void>;
	/** Cierra el drawer de ajuste. */
	closeDrawer: () => void;
	/** ¿Hay una acción de ajuste en vuelo? */
	isBusy: () => boolean;
	/** Marca/desmarca la acción de ajuste en vuelo. */
	setBusy: (busy: boolean) => void;
}

export function createAdjustmentActions(options: AdjustmentActionsOptions): {
	requestAdjust: (line: CountLineRow) => Promise<void>;
	requestBatch: () => Promise<void>;
	clearAdjust: (line: CountLineRow) => Promise<void>;
} {
	const { sessionId, getReason, replaceLine, refreshLines, closeDrawer, isBusy, setBusy } = options;

	/** D12.6: motivo «Otros» exige texto libre antes de salir al server. */
	function reasonPayload(): {
		invalid: boolean;
		reason: AdjustmentReason;
		reasonText: string | null;
	} {
		const { reason, reasonText } = getReason();
		if (reason === AdjustmentReason.OTHER && !reasonText.trim()) {
			return { invalid: true, reason, reasonText: null };
		}
		return {
			invalid: false,
			reason,
			reasonText: reason === AdjustmentReason.OTHER ? reasonText.trim() : null
		};
	}

	async function requestAdjust(line: CountLineRow): Promise<void> {
		const payload = reasonPayload();
		if (payload.invalid) {
			toast.error('Escribe el motivo');
			return;
		}
		if (isBusy()) return;
		setBusy(true);
		try {
			const response = await requestLineAdjustmentCmd({
				lineId: line.id,
				reason: payload.reason,
				reasonText: payload.reasonText
			});
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			replaceLine(response.data);
			closeDrawer();
			toast.success(`Ajuste listo para el cierre (${ADJUSTMENT_REASON_LABELS[payload.reason]})`);
		} catch (error) {
			logger.error('No se pudo solicitar el ajuste', error);
			toast.error(getErrorMessage(error, 'No se pudo solicitar el ajuste'));
		} finally {
			setBusy(false);
		}
	}

	async function requestBatch(): Promise<void> {
		const payload = reasonPayload();
		if (payload.invalid) {
			toast.error('Escribe el motivo');
			return;
		}
		if (isBusy()) return;
		setBusy(true);
		try {
			const response = await requestAdjustmentsBatchCmd({
				sessionId,
				reason: payload.reason,
				reasonText: payload.reasonText
			});
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			await refreshLines();
			closeDrawer();
			toast.success(`${response.data} ajuste(s) listos para el cierre`);
		} catch (error) {
			logger.error('No se pudieron solicitar los ajustes', error);
			toast.error(getErrorMessage(error, 'No se pudieron solicitar los ajustes'));
		} finally {
			setBusy(false);
		}
	}

	async function clearAdjust(line: CountLineRow): Promise<void> {
		if (isBusy()) return;
		setBusy(true);
		try {
			const response = await clearLineAdjustmentCmd({ lineId: line.id });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			replaceLine(response.data);
			toast.success('Ajuste quitado');
		} catch (error) {
			logger.error('No se pudo quitar el ajuste', error);
			toast.error(getErrorMessage(error, 'No se pudo quitar el ajuste'));
		} finally {
			setBusy(false);
		}
	}

	return { requestAdjust, requestBatch, clearAdjust };
}
