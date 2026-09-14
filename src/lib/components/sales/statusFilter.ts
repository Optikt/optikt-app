import { ALL_SALE_STATUSES, type SaleStatus } from '$lib/shared/enums';

/** Parse comma-separated statuses from URL (?status=PENDING,READY). Invalid values are ignored. */
export function parseSaleStatuses(value: string | null): SaleStatus[] {
	if (!value) return [];
	return value
		.split(',')
		.map((v) => v.trim())
		.filter((v): v is SaleStatus => ALL_SALE_STATUSES.includes(v as SaleStatus));
}

/** Serialize for URL (?status=...). Empty array clears the param. */
export function serializeSaleStatuses(statuses: SaleStatus[]): string | null {
	return statuses.length > 0 ? statuses.join(',') : null;
}
