import type { ProductWithRelations } from '#lib/server/db/queries/products.js';

export function isLowStock(product: ProductWithRelations): boolean {
	if (product.stock === null || product.minStock === null) return false;
	return product.stock <= product.minStock;
}
