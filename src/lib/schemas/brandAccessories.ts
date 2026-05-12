import { z } from 'zod';

import { CoercedBoolean, CoercedNumber, EntityIdSchema } from './common';

const OptionalUuidOverrideSchema = z.preprocess(
	(value) => (value === '' || value === null || value === undefined ? null : value),
	z.uuid('Producto inválido').nullable()
);

export const GetAccessoriesForProductSchema = z.object({
	productId: z.uuid('Producto inválido'),
	brandId: z.uuid('Marca inválida')
});

export const BrandAccessoryIdSchema = z.object({
	id: z.coerce.number().int('Regla inválida').positive('Regla inválida')
});

export const BrandAccessoriesByBrandSchema = z.object({
	brandId: z.uuid('Marca inválida')
});

export const ProductAccessoryOverrideSchema = EntityIdSchema('Producto');

export const UpsertBrandAccessorySchema = z.object({
	id: z.coerce.number().int('Regla inválida').positive('Regla inválida').optional(),
	brandId: z.uuid('Marca inválida'),
	productId: OptionalUuidOverrideSchema.optional(),
	accessoryProductId: z.uuid('Accesorio inválido'),
	defaultPrice: CoercedNumber.min(0, 'Precio debe ser mayor o igual a 0'),
	isActive: CoercedBoolean.default(true)
});

export const ToggleProductOverrideSchema = z.object({
	productId: z.uuid('Producto inválido'),
	brandId: z.uuid('Marca inválida'),
	isActive: CoercedBoolean
});

export type UpsertBrandAccessoryInput = z.infer<typeof UpsertBrandAccessorySchema>;
