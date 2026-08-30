/**
 * User management schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { UserRole } from '$lib/shared/enums';
import {
	EmailSchema,
	UsernameSchema,
	PasswordSchema,
	OptionalPasswordSchema,
	NameSchema,
	ListPaginationWithInactiveSchema,
	EntityIdSchema,
	ReactivateEntitySchema
} from './common';

export const ListUsersSchema = ListPaginationWithInactiveSchema.extend({
	role: z.enum(UserRole).optional()
});

export const CreateUserSchema = z.object({
	email: EmailSchema,
	username: UsernameSchema,
	fullName: NameSchema('Nombre completo requerido'),
	password: PasswordSchema,
	role: z.enum(UserRole).default(UserRole.VIEWER)
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
	id: z.uuid(),
	// Password can be empty (keep current) or valid password
	password: OptionalPasswordSchema.optional()
});

export const UserIdSchema = EntityIdSchema();

export const ReactivateUserSchema = ReactivateEntitySchema('deletedUserId', CreateUserSchema.shape);
