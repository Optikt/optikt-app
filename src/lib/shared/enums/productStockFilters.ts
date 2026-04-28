export enum ProductStockFilter {
	IN_STOCK = 'IN_STOCK',
	LOW_STOCK = 'LOW_STOCK',
	OUT_OF_STOCK = 'OUT_OF_STOCK'
}

export const ALL_PRODUCT_STOCK_FILTERS = Object.values(ProductStockFilter) as ProductStockFilter[];

export const PRODUCT_STOCK_FILTER_LABELS: Record<ProductStockFilter, string> = {
	[ProductStockFilter.IN_STOCK]: 'Con stock',
	[ProductStockFilter.LOW_STOCK]: 'Stock bajo',
	[ProductStockFilter.OUT_OF_STOCK]: 'Sin stock'
};
