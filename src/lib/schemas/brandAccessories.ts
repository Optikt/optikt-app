import { z } from 'zod';

import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
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

export const UpsertBrandAccessorySchema = z
	.object({
		id: z.coerce.number().int('Regla inválida').positive('Regla inválida').optional(),
		brandId: z.uuid('Marca inválida'),
		productId: OptionalUuidOverrideSchema.optional(),
		accessoryProductId: z.uuid('Accesorio inválido'),
		priceMode: z.enum(BrandAccessoryPriceMode),
		customPrice: CoercedNumber.positive('Precio personalizado debe ser mayor a 0')
			.optional()
			.nullable(),
		isActive: CoercedBoolean.default(true)
	})
	.superRefine((data, ctx) => {
		if (data.priceMode === BrandAccessoryPriceMode.CUSTOM) {
			if (data.customPrice == null || data.customPrice <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Precio personalizado es requerido',
					path: ['customPrice']
				});
			}
			return;
		}

		if (data.customPrice != null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'customPrice solo se permite cuando el modo es CUSTOM',
				path: ['customPrice']
			});
		}
	});

export const ToggleProductOverrideSchema = z.object({
	productId: z.uuid('Producto inválido'),
	brandId: z.uuid('Marca inválida'),
	isActive: CoercedBoolean
});

export type UpsertBrandAccessoryInput = z.infer<typeof UpsertBrandAccessorySchema>;
