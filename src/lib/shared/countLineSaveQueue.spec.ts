import { describe, expect, it } from 'vitest';
import { createLineSaveQueue } from './countLineSaveQueue';

/** Crea una cola con un `send` instrumentado: registra envíos y controla cuándo resuelven. */
function makeQueue() {
	const sent: Array<{ lineId: number; value: number }> = [];
	const gates = new Map<number, Array<() => void>>(); // envíos pendientes de soltar
	const inFlight = new Set<number>();
	const queue = createLineSaveQueue({
		inFlight,
		send: (lineId, value) => {
			sent.push({ lineId, value });
			return new Promise((resolve) => {
				const list = gates.get(lineId) ?? [];
				list.push(resolve);
				gates.set(lineId, list);
			});
		}
	});
	const release = (lineId: number) => {
		const list = gates.get(lineId) ?? [];
		gates.delete(lineId);
		list.forEach((r) => r());
	};
	return { queue, sent, release, inFlight };
}

describe('createLineSaveQueue', () => {
	it('envía de inmediato cuando la línea no está en vuelo', async () => {
		const { queue, sent, release, inFlight } = makeQueue();
		const p = queue.submit(1, 7);
		expect(sent).toEqual([{ lineId: 1, value: 7 }]);
		expect(inFlight.has(1)).toBe(true);
		expect(queue.isSaving(1)).toBe(true);
		release(1);
		await p;
		expect(inFlight.has(1)).toBe(false);
		expect(queue.isSaving(1)).toBe(false);
	});

	it('mientras la línea vuela, el siguiente valor se encola (último gana) y se envía al terminar', async () => {
		const { queue, sent, release } = makeQueue();
		const first = queue.submit(1, 7);
		const second = queue.submit(1, 8); // se encola, no dispara envío
		const third = queue.submit(1, 9); // pisa al anterior: solo viaja el último
		expect(sent).toHaveLength(1);

		release(1); // termina el envío de 7 → dispara el9 (el8 se descartó a propósito)
		await Promise.resolve();
		expect(sent).toEqual([
			{ lineId: 1, value: 7 },
			{ lineId: 1, value: 9 }
		]);
		release(1);
		await Promise.all([first, second, third]);
		expect(sent).toHaveLength(2);
	});

	it('líneas distintas se guardan en paralelo (un envío por línea)', async () => {
		const { queue, sent, release } = makeQueue();
		const a = queue.submit(1, 5);
		const b = queue.submit(2, 3);
		expect(sent).toHaveLength(2); // ambas en vuelo a la vez
		expect(sent.map((s) => s.lineId)).toEqual([1, 2]);
		release(1);
		release(2);
		await Promise.all([a, b]);
		expect(queue.isSaving(1)).toBe(false);
		expect(queue.isSaving(2)).toBe(false);
	});

	it('si el envío rechaza, se limpia el vuelo y el pendiente y el error llega al caller', async () => {
		const inFlight = new Set<number>();
		let fail = true;
		const queue = createLineSaveQueue({
			inFlight,
			send: async () => {
				if (fail) throw new Error('red caída');
			}
		});
		const p = queue.submit(1, 4);
		queue.submit(1, 6); // encolado mientras vuela
		await expect(p).rejects.toThrow('red caída');
		expect(inFlight.has(1)).toBe(false);
		expect(queue.isSaving(1)).toBe(false);
		// La cola no queda tocada: el siguiente envío funciona.
		fail = false;
		await queue.submit(1, 5);
		expect(inFlight.has(1)).toBe(false);
	});
});
