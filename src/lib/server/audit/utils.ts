import type { ChangeRecord } from '$lib/server/db/schema';

// ============================================================================
// DIFF UTILITIES
// ============================================================================

/**
 * Fields that should be excluded from change tracking.
 * These are system-managed fields that always change on updates.
 */
const EXCLUDED_FIELDS = new Set(['updatedAt', 'createdAt', 'deletedAt', 'id']);

/**
 * Calculate the differences between two entity states.
 * Returns a ChangeRecord with only the fields that changed.
 *
 * @param oldEntity - The entity state before the change
 * @param newEntity - The entity state after the change
 * @param excludeFields - Additional fields to exclude from comparison
 * @returns A ChangeRecord with the differences
 */
export function calculateDiff<T extends Record<string, unknown>>(
	oldEntity: T,
	newEntity: T,
	excludeFields: string[] = []
): ChangeRecord {
	const changes: ChangeRecord = {};
	const allExcluded = new Set([...EXCLUDED_FIELDS, ...excludeFields]);

	// Get all keys from both objects
	const allKeys = new Set([...Object.keys(oldEntity), ...Object.keys(newEntity)]);

	for (const key of allKeys) {
		// Skip excluded fields
		if (allExcluded.has(key)) continue;

		const oldValue = oldEntity[key];
		const newValue = newEntity[key];

		// Compare values (handles null, undefined, objects, arrays)
		if (!isEqual(oldValue, newValue)) {
			changes[key] = {
				old: normalizeValue(oldValue),
				new: normalizeValue(newValue)
			};
		}
	}

	return changes;
}

/**
 * Check if two values are equal (deep comparison for objects/arrays).
 */
function isEqual(a: unknown, b: unknown): boolean {
	// Handle null/undefined
	if (a === null && b === null) return true;
	if (a === undefined && b === undefined) return true;
	if (a === null || a === undefined || b === null || b === undefined) return false;

	// Handle dates
	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	// Handle primitives
	if (typeof a !== 'object' || typeof b !== 'object') {
		return a === b;
	}

	// Handle arrays
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, index) => isEqual(item, b[index]));
	}

	// Handle objects
	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const aKeys = Object.keys(aObj);
	const bKeys = Object.keys(bObj);

	if (aKeys.length !== bKeys.length) return false;

	return aKeys.every((key) => isEqual(aObj[key], bObj[key]));
}

/**
 * Normalize a value for storage in the changes JSON.
 * Converts dates to ISO strings, etc.
 */
function normalizeValue(value: unknown): unknown {
	if (value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(normalizeValue);
	if (value !== null && typeof value === 'object') {
		const normalized: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			normalized[k] = normalizeValue(v);
		}
		return normalized;
	}
	return value;
}

/**
 * Create a change record for a new entity (all fields are "new").
 */
export function createChangeRecordForCreate<T extends Record<string, unknown>>(
	entity: T,
	excludeFields: string[] = []
): ChangeRecord {
	const changes: ChangeRecord = {};
	const allExcluded = new Set([...EXCLUDED_FIELDS, ...excludeFields]);

	for (const [key, value] of Object.entries(entity)) {
		if (allExcluded.has(key)) continue;
		if (value === null || value === undefined) continue;

		changes[key] = {
			old: null,
			new: normalizeValue(value)
		};
	}

	return changes;
}

/**
 * Create a change record for a deleted entity (all fields become "old").
 */
export function createChangeRecordForDelete<T extends Record<string, unknown>>(
	entity: T,
	excludeFields: string[] = []
): ChangeRecord {
	const changes: ChangeRecord = {};
	const allExcluded = new Set([...EXCLUDED_FIELDS, ...excludeFields]);

	for (const [key, value] of Object.entries(entity)) {
		if (allExcluded.has(key)) continue;
		if (value === null || value === undefined) continue;

		changes[key] = {
			old: normalizeValue(value),
			new: null
		};
	}

	return changes;
}

/**
 * Check if a change record has any meaningful changes.
 */
export function hasChanges(changes: ChangeRecord): boolean {
	return Object.keys(changes).length > 0;
}

/**
 * Format a change value for display.
 * Handles different types of values (booleans, dates, arrays, etc.)
 */
export function formatChangeValue(value: unknown): string {
	if (value === null || value === undefined) return '—';
	if (typeof value === 'boolean') return value ? 'Sí' : 'No';
	if (typeof value === 'number') return value.toLocaleString('es-VE');
	if (typeof value === 'string') {
		// Check if it's an ISO date string
		if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
			try {
				const date = new Date(value);
				return date.toLocaleDateString('es-VE', {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				});
			} catch {
				return value;
			}
		}
		return value;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return '(vacío)';
		return value.map((v) => formatChangeValue(v)).join(', ');
	}
	if (typeof value === 'object') {
		return JSON.stringify(value);
	}
	return String(value);
}

/**
 * Get a summary of what changed (e.g., "3 campos modificados")
 */
export function getChangeSummary(changes: ChangeRecord): string {
	const count = Object.keys(changes).length;
	if (count === 0) return 'Sin cambios';
	if (count === 1) return '1 campo modificado';
	return `${count} campos modificados`;
}
