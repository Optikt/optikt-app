export interface TaxDisplayMeta {
	label: string;
	className: string;
}

export function formatTaxRate(rate: number): string {
	return Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
}

export function getTaxMeta(isTaxable: boolean, taxRate: number): TaxDisplayMeta {
	if (isTaxable && taxRate > 0) {
		return {
			label: `IVA ${formatTaxRate(taxRate)}%`,
			className: 'bg-success-container text-on-success-container'
		};
	}

	return {
		label: 'Exento',
		className: 'bg-surface-container-high text-on-surface-variant'
	};
}

export function getDiscountToggleButtonClass(isActive: boolean): string {
	return isActive
		? 'bg-brand-navy text-white shadow-sm'
		: 'text-on-surface-variant hover:bg-surface-container-high';
}
