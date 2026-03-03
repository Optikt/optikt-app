/**
 * Customers validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import {
	PhoneSchema,
	IdNumberSchema,
	NameSchema,
	OptionalEmailSchema,
	ListPaginationWithDeletedSchema,
	EntityIdSchema
} from './common';

export const ListCustomersSchema = ListPaginationWithDeletedSchema;

export const CustomerIdSchema = EntityIdSchema();

export const CreateCustomerSchema = z.object({
	firstName: NameSchema(),
	lastName: NameSchema('Apellido requerido'),
	idNumber: IdNumberSchema,
	birthDate: z.iso.date('Fecha de nacimiento inválida'),
	primaryPhone: PhoneSchema,
	email: OptionalEmailSchema,
	address: z.string().optional(),
	secondaryPhones: z.array(PhoneSchema).optional(),
	notes: z.string().optional()
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
	id: z.uuid()
});

export const ReactivateCustomerSchema = z.object({
	id: z.uuid()
});
