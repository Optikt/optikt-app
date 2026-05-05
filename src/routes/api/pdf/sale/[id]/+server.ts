import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePdf } from '$lib/server/pdf';
import { findSaleByIdWithRelations } from '$lib/server/db/queries/sales';
import { SaleStatus } from '$lib/shared/enums';

export const GET: RequestHandler = async ({ params, locals, request, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	if (sale.status !== SaleStatus.PENDING && sale.status !== SaleStatus.COMPLETED) {
		error(409, 'No se puede imprimir una venta cancelada');
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
