/**
 * Generates a UUID v4 string for frontend use only.
 *
 * @remarks
 * This function is designed exclusively for client-side environments and should NOT be used
 * for security-critical operations. It generates temporary, non-cryptographic UUIDs suitable for:
 * - Form field identifiers
 * - Temporary pending IDs
 * - UI component keys that will be discarded
 *
 * For server-side operations, use Node.js's native `crypto.randomUUID()` directly instead.
 *
 * @returns A UUID v4 string in the format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
 *
 * @example
 * ```typescript
 * const tempId = generateUUID(); // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateUUID(): string {
	// Prefer native crypto.randomUUID when available (secure contexts / modern runtimes)
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	// Fallback for insecure contexts or older environments
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export default generateUUID;
