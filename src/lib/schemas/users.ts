/**
 * User management schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { UserRole, ALL_ROLES } from '$lib/shared/enums';
import { CoercedBoolean } from './common';

export const ListUsersSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional(),
	role: z.enum(ALL_ROLES).optional(),
	includeInactive: z.boolean().default(false)
});

export const CreateUserSchema = z.object({
	email: z.email('Email inválido').max(255),
	username: z
		.string()
		.min(3, 'Usuario debe tener al menos 3 caracteres')
		.max(50)
		.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos'),
	fullName: z.string().min(2, 'Nombre completo requerido').max(255),
	password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
	role: z.enum(ALL_ROLES).default(UserRole.VIEWER),
	isActive: CoercedBoolean.default(true)
});

export const UpdateUserSchema = z.object({
	id: z.uuid(),
	email: z.email('Email inválido').max(255).optional(),
	username: z
		.string()
		.min(3, 'Usuario debe tener al menos 3 caracteres')
		.max(50)
		.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos')
		.optional(),
	fullName: z.string().min(2).max(255).optional(),
	// Password can be empty (keep current) or valid password (min 8 chars)
	password: z
		.union([z.literal(''), z.string().min(8, 'Contraseña debe tener al menos 8 caracteres')])
		.optional(),
	role: z.enum(ALL_ROLES).optional(),
	isActive: CoercedBoolean.optional()
});

export const UserIdSchema = z.object({
	id: z.uuid()
});

export const ReactivateUserSchema = z.object({
	deletedUserId: z.uuid(),
	email: z.email('Email inválido').max(255),
	username: z
		.string()
		.min(3, 'Usuario debe tener al menos 3 caracteres')
		.max(50)
		.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos'),
	fullName: z.string().min(2, 'Nombre completo requerido').max(255),
	password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres'),
	role: z.enum(ALL_ROLES).default(UserRole.VIEWER),
	isActive: CoercedBoolean.default(true)
});
