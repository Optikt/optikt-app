/**
 * Customers validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { PhoneSchema, IdNumberSchema } from './common/contacts';
import {
	NameSchema,
	OptionalEmailSchema,
	EntityIdSchema,
	ReactivateEntitySchema
} from './common/identity';
import { ListPaginationWithDeletedSchema } from './common/pagination';
import { PrescriptionFieldsSchema } from './prescriptions';
import { ALL_CUSTOMER_GENDERS } from '$lib/shared/enums/customerGenders';

export const ListCustomersSchema = ListPaginationWithDeletedSchema;

export const CustomerIdSchema = EntityIdSchema();

export const CreateCustomerSchema = z.object({
	firstName: NameSchema(),
	lastName: NameSchema('Apellido requerido'),
	idNumber: IdNumberSchema,
	birthDate: z.iso.date('Fecha de nacimiento inválida').or(z.literal('')).optional(),
	gender: z.enum(ALL_CUSTOMER_GENDERS).or(z.literal('')).optional(),
	primaryPhone: PhoneSchema,
	email: OptionalEmailSchema,
	address: z.string().optional(),
	secondaryPhones: z.array(PhoneSchema).optional(),
	notes: z.string().optional()
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
	id: z.uuid()
});

/**
 * Create customer with optional prescription.
 * When prescription is present, both are created atomically in a single transaction.
 */
export const CreateCustomerWithPrescriptionSchema = CreateCustomerSchema.extend({
	prescription: PrescriptionFieldsSchema.optional()
});

export const ReactivateCustomerSchema = ReactivateEntitySchema('id');
