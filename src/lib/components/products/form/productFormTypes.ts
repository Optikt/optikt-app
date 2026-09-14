export interface ProductFormData {
	sku: string;
	name: string;
	type: string;
	brandId: string;
	supplierId: string;
	materialId: string;
	gender: string;
	personalCode: string;
	color: string;
	size: string;
	description: string;
	isTaxable: boolean;
	minStock: number;
	imageUrl: string;
	lensWidth: string | number;
	bridgeWidth: string | number;
	templeLength: string | number;
	baseCurve: string | number;
	diameter: string | number;
}
