import { z } from 'zod';

/**
 * Impresión de recibo de venta en la tickera (agente local optikt-print-agent).
 * NO reemplaza el recibo A4/PDF: es un recibo distinto para rollo 80mm.
 */
export const PrintTickeraSchema = z.object({
	saleId: z.string().uuid()
});

export type PrintTickeraInput = z.infer<typeof PrintTickeraSchema>;
