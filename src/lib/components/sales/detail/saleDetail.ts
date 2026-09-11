import { RefundStatus, SaleStatus } from '$lib/shared/enums';

export interface SaleCustomerLike {
	firstName: string;
	lastName: string;
	idNumber?: string | null;
}

export function customerName(sale: { customer?: SaleCustomerLike | null }): string {
	if (!sale.customer) return 'Cliente no asignado';
	return `${sale.customer.firstName} ${sale.customer.lastName}`;
}

export function customerIdNumber(sale: { customer?: SaleCustomerLike | null }): string {
	return sale.customer?.idNumber ?? 'Documento no registrado';
}

export function refundCardClasses(refundStatus: string | null | undefined): string {
	if (refundStatus === RefundStatus.REFUNDED) {
		return 'bg-red-50 border-red-200 text-red-800';
	}

	if (refundStatus === RefundStatus.RETAINED) {
		return 'bg-amber-50 border-amber-200 text-amber-800';
	}

	return 'bg-gray-50 border-gray-200 text-gray-700';
}

export function refundDecisionTitle(refundStatus: string | null | undefined): string {
	if (refundStatus === RefundStatus.REFUNDED) return 'Reembolso emitido';
	if (refundStatus === RefundStatus.RETAINED) return 'Depósito retenido';
	return 'Sin pagos previos';
}

export function nextStatusTargets(status: string): SaleStatus[] | null {
	if (status === SaleStatus.PENDING) {
		return [SaleStatus.IN_PROGRESS, SaleStatus.READY, SaleStatus.COMPLETED];
	}

	if (status === SaleStatus.IN_PROGRESS) {
		return [SaleStatus.READY, SaleStatus.COMPLETED];
	}

	if (status === SaleStatus.READY) {
		return [SaleStatus.COMPLETED];
	}

	return null;
}
