/** Primitive values that Svelecte can surface directly in single-select change payloads. */
export type SelectOptionPrimitive = string | number | boolean | null | undefined;

/** Flat option shape used by shared select helpers when reading a configurable value field. */
export type SelectOptionRecord = Record<string, SelectOptionPrimitive>;

/** Supported payload shapes emitted by shared single-select wrappers. */
export type SelectChangeValue =
	| SelectOptionPrimitive
	| SelectOptionRecord
	| Array<SelectOptionPrimitive | SelectOptionRecord>;

function getOptionFieldValue(option: object, valueField: string): string {
	const fieldValue = (option as SelectOptionRecord)[valueField];

	if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
		return String(fieldValue);
	}

	return '';
}

/**
 * Returns the original single-select value only when it still exists in the current option list.
 * Falls back to an empty string when the selection became stale.
 */
export function normalizeSingleSelectValue(
	value: string | null | undefined,
	options: object[],
	valueField = 'id'
): string {
	if (!value) return '';

	return options.some((option) => getOptionFieldValue(option, valueField) === value) ? value : '';
}

/**
 * Extracts a string identifier from single-select change payloads emitted by Svelecte wrappers.
 * Supports scalar, object, array, and nullish payloads and returns an empty string when absent.
 */
export function getSingleSelectValue(
	value: SelectChangeValue | null | undefined,
	valueField = 'id'
): string {
	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}

	if (Array.isArray(value)) {
		return getSingleSelectValue(value[0], valueField);
	}

	if (!value || typeof value !== 'object') {
		return '';
	}

	return getOptionFieldValue(value, valueField);
}
