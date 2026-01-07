/**
 * User management schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { UserRole, ALL_ROLES } from '$lib/shared/enums';

export const ListUsersSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10),
	search: v.optional(v.string()),
	role: v.optional(v.picklist(ALL_ROLES)),
	includeInactive: v.optional(v.boolean(), false)
});

export const CreateUserSchema = v.object({
	email: v.pipe(v.string(), v.email('Email inválido'), v.maxLength(255)),
	username: v.pipe(
		v.string(),
		v.minLength(3, 'Usuario debe tener al menos 3 caracteres'),
		v.maxLength(50),
		v.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos')
	),
	fullName: v.pipe(v.string(), v.minLength(2, 'Nombre completo requerido'), v.maxLength(255)),
	password: v.pipe(v.string(), v.minLength(8, 'Contraseña debe tener al menos 8 caracteres')),
	role: v.optional(v.picklist(ALL_ROLES), UserRole.VIEWER),
	isActive: v.optional(v.boolean(), true)
});

export const UpdateUserSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	email: v.optional(v.pipe(v.string(), v.email('Email inválido'), v.maxLength(255))),
	username: v.optional(
		v.pipe(
			v.string(),
			v.minLength(3, 'Usuario debe tener al menos 3 caracteres'),
			v.maxLength(50),
			v.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos')
		)
	),
	fullName: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(255))),
	password: v.optional(
		v.pipe(v.string(), v.minLength(8, 'Contraseña debe tener al menos 8 caracteres'))
	),
	role: v.optional(v.picklist(ALL_ROLES)),
	isActive: v.optional(v.boolean())
});

export const UserIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});

export const ReactivateUserSchema = v.object({
	deletedUserId: v.pipe(v.string(), v.uuid()),
	email: v.pipe(v.string(), v.email('Email inválido'), v.maxLength(255)),
	username: v.pipe(
		v.string(),
		v.minLength(3, 'Usuario debe tener al menos 3 caracteres'),
		v.maxLength(50),
		v.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos')
	),
	fullName: v.pipe(v.string(), v.minLength(2, 'Nombre completo requerido'), v.maxLength(255)),
	password: v.pipe(v.string(), v.minLength(8, 'Contraseña debe tener al menos 8 caracteres')),
	role: v.optional(v.picklist(ALL_ROLES), UserRole.VIEWER),
	isActive: v.optional(v.boolean(), true)
});
