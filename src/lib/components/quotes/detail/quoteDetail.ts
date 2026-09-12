import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';

export type QuoteActionVariant = 'neutral' | 'danger';

export function quoteCustomerName(quote: {
	customer?: { firstName: string; lastName: string } | null;
}): string {
	if (!quote.customer) return 'Sin cliente';
	return `${quote.customer.firstName} ${quote.customer.lastName}`;
}

export function quoteCustomerIdNumber(quote: {
	customer?: { idNumber?: string | null } | null;
}): string {
	return quote.customer?.idNumber ?? '';
}

export function actionButtonClasses(variant: QuoteActionVariant): string {
	if (variant === 'danger') {
		return 'bg-error-container text-on-error-container hover:bg-error-container/80';
	}

	return 'bg-surface-container-low text-brand-navy hover:bg-surface-container-high';
}

export function coerceNewCustomer(
	assignNewCustomer: NewCustomerData | null
): NewCustomerData | undefined {
	const hasNew =
		!!assignNewCustomer && !!assignNewCustomer.firstName && !!assignNewCustomer.lastName;
	return hasNew ? (assignNewCustomer ?? undefined) : undefined;
}

export function canSubmitAssignCustomer(
	assignCustomerId: string,
	assignNewCustomer: NewCustomerData | null
): boolean {
	return !!assignCustomerId || coerceNewCustomer(assignNewCustomer) !== undefined;
}
