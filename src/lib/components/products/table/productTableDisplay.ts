import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { isLowStock } from '$lib/utils/products';

export const productTableColumns = [
	{ key: 'product', label: 'Producto' },
	{ key: 'code', label: 'Codigo' },
	{ key: 'sku', label: 'SKU' },
	{ key: 'type', label: 'Categoría' },
	{ key: 'brand', label: 'Marca' },
	{ key: 'stock', label: 'Stock' },
	{ key: 'price', label: 'Precio', align: 'right' as const },
	{ key: 'actions', label: 'Acciones', align: 'right' as const }
];

export function stockBadgeVariant(
	product: ProductWithRelations
): 'success' | 'warning' | 'error' | 'neutral' {
	if (product.deletedAt) return 'neutral';
	if (product.stock === 0) return 'error';
	if (isLowStock(product)) return 'warning';
	return 'success';
}

export function stockLabel(product: ProductWithRelations): string {
	if (product.deletedAt) return 'Eliminado';
	if (product.stock === 0) return 'Agotado';
	if (isLowStock(product)) return 'Stock bajo';
	return 'En stock';
}

export function stockCountClasses(product: ProductWithRelations): string {
	const variant = stockBadgeVariant(product);

	if (variant === 'error') return 'bg-error text-white';
	if (variant === 'warning') return 'bg-warning-container text-on-warning-container';
	if (variant === 'success') return 'bg-success-container text-on-success-container';
	return 'bg-surface-container-high text-on-surface-variant';
}
