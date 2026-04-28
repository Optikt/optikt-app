import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePdf } from '$lib/server/pdf';
import { findSaleByIdWithRelations } from '$lib/server/db/queries/sales';

export const GET: RequestHandler = async ({ params, locals, request, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	const printUrl = new URL(`/print/sale/${params.id}`, url).toString();
	const cookieHeader = request.headers.get('cookie');
	const pdf = await generatePdf(printUrl, cookieHeader);
	const fileName = `recibo-venta-${String(sale.orderNumber).padStart(4, '0')}.pdf`;

	return new Response(new Uint8Array(pdf), {
		headers: {
			'Cache-Control': 'no-store',
			'Content-Disposition': `inline; filename="${fileName}"`,
			'Content-Length': String(pdf.length),
			'Content-Type': 'application/pdf'
		}
	});
};
