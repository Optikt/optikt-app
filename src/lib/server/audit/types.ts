/**
 * Server-side Audit Types
 * Types used by the audit service for logging changes.
 */
import type { ActionType } from '$lib/server/db/schema';

// ============================================================================
// AUDIT CONTEXT
// ============================================================================

/**
 * Context information for audit logging.
 * Passed to update/create/delete functions to capture who made the change.
 */
export interface AuditContext {
	/** ID of the user making the change (null for system changes) */
	userId?: string | null;
	/** IP address of the request */
	ipAddress?: string | null;
	/** User agent string from the request */
	userAgent?: string | null;
	/** Optional reason/description for the change */
	reason?: string | null;
}

// ============================================================================
// CHANGE HISTORY TYPES
// ============================================================================

export interface ChangeHistoryOptions {
	limit?: number;
	offset?: number;
	actions?: ActionType[];
}
