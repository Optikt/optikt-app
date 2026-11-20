/**
 * Diff helper for `update*` remotes (DT26).
 *
 * Semantics of each key in `input`:
 * - `undefined` → field omitted: **do not touch** (never in the result).
 * - `''` on a key listed in `emptyToNull` → field cleared on purpose: `null`.
 * - anything else → kept as-is.
 *
 * Only keys whose (normalized) value differs from `original` are returned, so
 * a partial payload never nulls omitted fields and an unchanged save writes nothing.
 */
export interface BuildChangedFieldsOptions<K extends PropertyKey> {
	/** Keys where an empty string means "clear the field" (stored as `null`). */
	emptyToNull?: readonly K[];
}

type Normalized<T, K extends PropertyKey> = {
	[P in keyof T]?: P extends K ? Exclude<T[P], undefined | ''> | null : Exclude<T[P], undefined>;
};

export function buildChangedFields<T extends Record<string, unknown>, K extends keyof T = never>(
	original: object,
	input: T,
	options: BuildChangedFieldsOptions<K> = {}
): Normalized<T, K> {
	const emptyToNull = new Set<PropertyKey>(options.emptyToNull ?? []);
	const current = original as Record<string, unknown>;
	const changes: Record<string, unknown> = {};

	for (const [key, raw] of Object.entries(input)) {
		if (raw === undefined) continue;
		const value = raw === '' && emptyToNull.has(key) ? null : raw;
		if (!isSameValue(current[key], value)) {
			changes[key] = value;
		}
	}

	return changes as Normalized<T, K>;
}

/** True when the diff produced no field to write. */
export function hasChangedFields(changes: object): boolean {
	return Object.keys(changes).length > 0;
}

function isSameValue(stored: unknown, next: unknown): boolean {
	const a = stored ?? null;
	const b = next ?? null;
	if (a === b) return true;
	if (a === null || b === null) return false;
	// numeric columns may come back as strings
	if (typeof a === 'number' || typeof b === 'number') {
		const na = Number(a);
		const nb = Number(b);
		return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
	}
	if (typeof a === 'object' || typeof b === 'object') {
		return stableStringify(a) === stableStringify(b);
	}
	return false;
}

function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, v: unknown) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(
					Object.entries(v as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : 1))
				)
			: v
	);
}
