/**
 * Cola de guardado de líneas de conteo.
 *
 * Un envío por línea a la vez; las ediciones que llegan mientras la línea está
 * en vuelo se encolan con «último valor gana» y se envían al terminar. Así un
 * Enter no descarta el valor siguiente (el guard global `isSubmitting` lo
 * perdía silenciosamente) y dos líneas distintas se guardan en paralelo.
 *
 * El Set `inFlight` lo aporta el caller — en Svelte se pasa como `$state(new Set())`
 * y la cola lo muta con add/delete, lo que dispara el re-render (readonly visual).
 */

export interface LineSaveQueue {
	/** Envia el valor; resuelve al terminar (incluidos los encolados). Rechaza si `send` rechaza. */
	submit(lineId: number, value: number): Promise<void>;
	isSaving(lineId: number): boolean;
}

export function createLineSaveQueue(options: {
	/** Set de líneas en vuelo; la cola lo muta con add/delete. */
	inFlight: Set<number>;
	/** Envío real (upsert remoto). Si rechaza, la cola propaga el error al caller. */
	send: (lineId: number, value: number) => Promise<void>;
}): LineSaveQueue {
	const { inFlight, send } = options;
	/** Valor pendiente por línea (solo existe mientras la línea está en vuelo). */
	const pending = new Map<number, number>();

	async function pump(lineId: number, target: number): Promise<void> {
		for (;;) {
			await send(lineId, target);
			// Sección síncrona: ningún evento puede intercalar un set entre get y delete.
			const next = pending.get(lineId);
			pending.delete(lineId);
			if (next === undefined || next === target) return;
			target = next;
		}
	}

	return {
		isSaving: (lineId) => inFlight.has(lineId),
		submit(lineId, value) {
			if (inFlight.has(lineId)) {
				pending.set(lineId, value); // último gana
				return Promise.resolve();
			}
			inFlight.add(lineId);
			return pump(lineId, value).finally(() => {
				pending.delete(lineId);
				inFlight.delete(lineId);
			});
		}
	};
}
