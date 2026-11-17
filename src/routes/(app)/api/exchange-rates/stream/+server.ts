import type { RequestHandler } from './$types';
import { getExchangeRatesSnapshot } from '$lib/server/exchangeRates/service';
import { hasSseCapacity, onRatesUpdated, touchListener } from '$lib/server/exchangeRates/events';
import { logger } from '$lib/utils';

/** User agents that are health checks / uptime probes, never real clients. */
const PROBE_UA_PATTERN = /kube-probe|dokploy|healthcheck|uptime|better\s*uptime|statuspage/i;

function isProbe(request: Request): boolean {
	return (
		request.method === 'HEAD' || PROBE_UA_PATTERN.test(request.headers.get('user-agent') ?? '')
	);
}

export const GET: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) {
		return new Response('No autorizado', { status: 401 });
	}

	// Health checks / bots must not count as clients.
	if (isProbe(request)) {
		return new Response(null, { status: 200 });
	}

	const cid = url.searchParams.get('cid')?.trim() || crypto.randomUUID();

	// Same-cid reconnects always fit; brand-new connections above the cap get 429.
	if (!hasSseCapacity(cid)) {
		logger.warn(
			`SSE connection rejected cid=${cid} user=${locals.user.id} reason=cap-reached (429)`
		);
		return new Response('Demasiadas conexiones activas', {
			status: 429,
			headers: { 'Retry-After': '30' }
		});
	}

	const stream = new ReadableStream({
		start(controller) {
			// Holder lets `close` run before both resources exist without TDZ issues.
			const state: {
				keepalive?: ReturnType<typeof setInterval>;
				unsubscribe?: () => void;
			} = {};

			const close = () => {
				if (state.keepalive) clearInterval(state.keepalive);
				state.unsubscribe?.();
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			function send(snapshot: ReturnType<typeof getExchangeRatesSnapshot>) {
				controller.enqueue(`data: ${JSON.stringify(snapshot)}\n\n`);
			}

			controller.enqueue(`event: hello\ndata: ${JSON.stringify({ cid })}\n\n`);
			send(getExchangeRatesSnapshot());

			state.unsubscribe = onRatesUpdated(cid, send, close, locals.user?.id ?? null);

			state.keepalive = setInterval(() => {
				try {
					controller.enqueue(': keepalive\n\n');
					touchListener(cid);
				} catch {
					// Dead connection that never aborted (zombie tab) — prune it.
					close();
				}
			}, 30_000);

			request.signal.addEventListener('abort', close);
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
