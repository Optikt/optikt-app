import { LensPriceType } from '$lib/shared/enums/lensTypes';

export interface LensPricingInput {
	basePrice: string;
	mountingPrice: string;
	shippingPrice: string;
	salePrice: string;
	priceType: LensPriceType;
}

export interface LensPricingResult {
	pairPurchasePrice: number;
	operationalCost: number;
	grossProfit: number | null;
	marginPercent: number | null;
	totalWithTax: number;
}

export function calculateLensPricing(input: LensPricingInput): LensPricingResult {
	const base = parseFloat(input.basePrice) || 0;
	const pairPurchasePrice = input.priceType === LensPriceType.UNIT ? base * 2 : base;

	const mounting = parseFloat(input.mountingPrice) || 0;
	const shipping = parseFloat(input.shippingPrice) || 0;
	const operationalCost = pairPurchasePrice + mounting + shipping;

	const sale = parseFloat(input.salePrice) || 0;
	const grossProfit = sale > 0 ? sale - operationalCost : null;
	const marginPercent = sale > 0 && grossProfit != null ? (grossProfit / sale) * 100 : null;
	const totalWithTax = sale > 0 ? sale : 0;

	return {
		pairPurchasePrice,
		operationalCost,
		grossProfit,
		marginPercent,
		totalWithTax
	};
}
