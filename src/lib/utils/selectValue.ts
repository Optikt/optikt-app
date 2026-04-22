export type SelectOptionPrimitive = string | number | boolean | null | undefined;
export type SelectOptionRecord = Record<string, SelectOptionPrimitive>;
export type SelectChangeValue =
	| SelectOptionPrimitive
	| SelectOptionRecord
	| Array<SelectOptionPrimitive | SelectOptionRecord>;

function getOptionFieldValue(option: SelectOptionRecord, valueField: string): string {
	const fieldValue = option[valueField];

	if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
		return String(fieldValue);
	}

	return '';
}

export function normalizeSingleSelectValue(
	value: string | null | undefined,
	options: SelectOptionRecord[],
	valueField = 'id'
): string {
	if (!value) return '';

	return options.some((option) => getOptionFieldValue(option, valueField) === value) ? value : '';
}

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
