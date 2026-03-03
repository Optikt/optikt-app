/**
 * User-related types
 */
import type { z } from 'zod';
import type { ListUsersSchema, CreateUserSchema, UpdateUserSchema } from '$lib/schemas/users';
import type { UserRole } from '$lib/shared/enums';

// Inferred input types from schemas
export type ListUsersInput = z.infer<typeof ListUsersSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

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

// Create user result - can indicate a reactivation candidate
export type CreateUserResult =
	| { success: true; user: UserListItem }
	| { success: false; reactivationCandidate: UserListItem; message: string };
