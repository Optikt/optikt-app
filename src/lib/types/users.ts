/**
 * User-related types
 */
import type * as v from 'valibot';
import type { ListUsersSchema, CreateUserSchema, UpdateUserSchema } from '$lib/schemas/users';
import type { UserRole } from '$lib/shared/enums';

// Inferred input types from schemas
export type ListUsersInput = v.InferOutput<typeof ListUsersSchema>;
export type CreateUserInput = v.InferOutput<typeof CreateUserSchema>;
export type UpdateUserInput = v.InferOutput<typeof UpdateUserSchema>;

// User list item (without sensitive data)
export interface UserListItem {
	id: string;
	email: string;
	username: string;
	fullName: string;
	role: UserRole;
	isActive: boolean;
	isSuperuser: boolean;
	createdAt: Date;
}

// Paginated response
export interface PaginatedUsers {
	users: UserListItem[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}
