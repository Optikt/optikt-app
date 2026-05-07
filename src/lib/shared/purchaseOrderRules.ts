import { PurchaseOrderItemType } from './enums';

export interface PurchaseOrderDraftHeaderRulesInput {
	supplierId: string | null;
	orderDate: string | null;
	bcvRate: number | null;
	notes: string | null;
}

export interface PurchaseOrderDraftLineRulesInput {
	itemType: string;
	productId: string | null;
	lensCatalogItemId: string | null;
	quantity: number;
	unitPurchasePrice: number;
	unitSalePrice: number;
	appliesIva: boolean;
	ivaRate: number;
}

export interface PurchaseOrderDraftReadinessResult {
	isReady: boolean;
	issues: string[];
}

export function getPurchaseOrderDraftReadinessIssues(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftLineRulesInput[]
): string[] {
	const issues: string[] = [];

	if (!header.supplierId) issues.push('Selecciona un proveedor');
	if (!header.orderDate) issues.push('Selecciona una fecha de orden');
	if (!Number.isFinite(Number(header.bcvRate)) || Number(header.bcvRate) <= 0) {
		issues.push('Define una tasa BCV mayor a 0');
	}
	if ((header.notes ?? '').trim().length < 6) {
		issues.push('Agrega observaciones de al menos 6 caracteres');
	}

	if (items.length === 0) {
		issues.push('Agrega al menos una línea');
	}

	items.forEach((item, index) => {
		const lineLabel = `Línea ${index + 1}`;

		if (item.itemType === PurchaseOrderItemType.PRODUCT && !item.productId) {
			issues.push(`${lineLabel}: selecciona un producto`);
		} else if (item.itemType === PurchaseOrderItemType.LENS && !item.lensCatalogItemId) {
			issues.push(`${lineLabel}: selecciona un lente`);
		} else if (
			![PurchaseOrderItemType.PRODUCT, PurchaseOrderItemType.LENS].includes(
				item.itemType as PurchaseOrderItemType
			)
		) {
			issues.push(`${lineLabel}: tipo de ítem inválido`);
		}

		if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) {
			issues.push(`${lineLabel}: la cantidad debe ser al menos 1`);
		}
		if (!Number.isFinite(Number(item.unitPurchasePrice)) || Number(item.unitPurchasePrice) < 0) {
			issues.push(`${lineLabel}: el costo no puede ser negativo`);
		}
		if (!Number.isFinite(Number(item.unitSalePrice)) || Number(item.unitSalePrice) < 0) {
			issues.push(`${lineLabel}: la venta sugerida no puede ser negativa`);
		}
		if (item.appliesIva && (!Number.isFinite(Number(item.ivaRate)) || Number(item.ivaRate) < 0)) {
			issues.push(`${lineLabel}: la tasa IVA no puede ser negativa`);
		}
	});

	return issues;
}

export function validatePurchaseOrderDraftReadiness(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftLineRulesInput[]
): PurchaseOrderDraftReadinessResult {
	const issues = getPurchaseOrderDraftReadinessIssues(header, items);
	return { isReady: issues.length === 0, issues };
}

export function isPurchaseOrderDraftReady(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftLineRulesInput[]
): boolean {
	return getPurchaseOrderDraftReadinessIssues(header, items).length === 0;
}
