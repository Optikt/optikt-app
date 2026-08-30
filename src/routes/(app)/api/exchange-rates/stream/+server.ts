import type { RequestHandler } from './$types';
import { getExchangeRatesSnapshot } from '$lib/server/exchangeRates/service';
import { onRatesUpdated } from '$lib/server/exchangeRates/events';

export const GET: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return new Response('No autorizado', { status: 401 });
	}

	const stream = new ReadableStream({
		start(controller) {
			function send(snapshot: ReturnType<typeof getExchangeRatesSnapshot>) {
				controller.enqueue(`data: ${JSON.stringify(snapshot)}\n\n`);
			}

			send(getExchangeRatesSnapshot());

			const unsubscribe = onRatesUpdated(send);

			const keepalive = setInterval(() => {
				controller.enqueue(': keepalive\n\n');
			}, 30_000);

			request.signal.addEventListener('abort', () => {
				unsubscribe();
				clearInterval(keepalive);
				try {
					controller.close();
				} catch {
					// already closed
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
