import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findQuoteByIdWithRelations } from '$lib/server/db/queries/quotes';
import { generatePdf } from '$lib/server/pdf';

export const GET: RequestHandler = async ({ params, locals, request, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const quote = await findQuoteByIdWithRelations(params.id);
	if (!quote) {
		error(404, 'Presupuesto no encontrado');
	}

	const { PORT = '' } = process.env;
	const origin = PORT ? `http://localhost:${PORT}` : url.origin;
	const printUrl = new URL(`/print/quote/${params.id}`, origin).toString();
	const cookieHeader = request.headers.get('cookie');
	const pdf = await generatePdf(printUrl, cookieHeader);
	const fileName = `presupuesto-${String(quote.quoteNumber).padStart(4, '0')}.pdf`;

	return new Response(new Uint8Array(pdf), {
		headers: {
			'Cache-Control': 'no-store',
			'Content-Disposition': `inline; filename="${fileName}"`,
			'Content-Length': String(pdf.length),
			'Content-Type': 'application/pdf'
		}
	});
};
