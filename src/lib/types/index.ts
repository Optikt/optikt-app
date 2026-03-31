import type { Icon } from '@lucide/svelte';

export type LucideIcon = typeof Icon;

/** Generic paginated result for list queries */
export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

/** Generic result for entity creation with optional reactivation candidate */
export interface CreateEntityResult<T> {
	success: boolean;
	message: string;
	entity?: T;
	reactivationCandidate?: T;
}

// User types
export * from './users';
