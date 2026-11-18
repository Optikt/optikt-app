/** Resumen mínimo de la venta generada por un presupuesto (hero del detalle). */
export interface ConvertedSaleInfo {
	id: string;
	orderNumber: number;
	status: string;
	total: number;
	paidAmountBcvUsd: number;
	createdAt: string;
}
