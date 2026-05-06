import { z } from 'zod';

export const BrandSupplierRelationSchema = z.object({
	brandId: z.uuid('Marca invalida'),
	supplierId: z.uuid('Proveedor invalido')
});
