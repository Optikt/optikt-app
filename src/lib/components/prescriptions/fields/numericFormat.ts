import type { PrescriptionFormData } from '../prescription-form';

export type NumericField =
	| 'odSphere'
	| 'odCylinder'
	| 'odAxis'
	| 'odAddition'
	| 'odAltura'
	| 'osSphere'
	| 'osCylinder'
	| 'osAxis'
	| 'osAddition'
	| 'osAltura'
	| 'dp'
	| 'npRight'
	| 'npLeft';

export interface NumericFieldConfig {
	inputmode: 'decimal' | 'numeric';
	step: string;
	min?: number;
	max?: number;
	allowNegative: boolean;
	allowDecimal: boolean;
	decimals: number;
}

const EDITING_KEYS = new Set([
	'Backspace',
	'Delete',
	'Tab',
	'Enter',
	'Escape',
	'ArrowLeft',
	'ArrowRight',
	'ArrowUp',
	'ArrowDown',
	'Home',
	'End'
]);

const numericFieldConfigs = {
	odSphere: {
		inputmode: 'decimal',
		step: '0.25',
		min: -30,
		max: 30,
		allowNegative: true,
		allowDecimal: true,
		decimals: 2
	},
	odCylinder: {
		inputmode: 'decimal',
		step: '0.25',
		min: -10,
		max: 0,
		allowNegative: true,
		allowDecimal: true,
		decimals: 2
	},
	odAxis: {
		inputmode: 'numeric',
		step: '1',
		min: 0,
		max: 180,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	},
	odAddition: {
		inputmode: 'decimal',
		step: '0.25',
		min: 0,
		max: 5,
		allowNegative: false,
		allowDecimal: true,
		decimals: 2
	},
	osSphere: {
		inputmode: 'decimal',
		step: '0.25',
		min: -30,
		max: 30,
		allowNegative: true,
		allowDecimal: true,
		decimals: 2
	},
	osCylinder: {
		inputmode: 'decimal',
		step: '0.25',
		min: -10,
		max: 0,
		allowNegative: true,
		allowDecimal: true,
		decimals: 2
	},
	osAxis: {
		inputmode: 'numeric',
		step: '1',
		min: 0,
		max: 180,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	},
	osAddition: {
		inputmode: 'decimal',
		step: '0.25',
		min: 0,
		max: 5,
		allowNegative: false,
		allowDecimal: true,
		decimals: 2
	},
	dp: {
		inputmode: 'numeric',
		step: '1',
		min: 10,
		max: 80,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	},
	npRight: {
		inputmode: 'numeric',
		step: '1',
		min: 10,
		max: 80,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	},
	npLeft: {
		inputmode: 'numeric',
		step: '1',
		min: 10,
		max: 80,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	},
	odAltura: {
		inputmode: 'numeric',
		step: '1',
		min: 10,
		max: 40,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	},
	osAltura: {
		inputmode: 'numeric',
		step: '1',
		min: 10,
		max: 40,
		allowNegative: false,
		allowDecimal: false,
		decimals: 0
	}
} satisfies Record<NumericField, NumericFieldConfig>;

export function getNumericFieldConfig(field: NumericField): NumericFieldConfig {
	return numericFieldConfigs[field];
}

export function sanitizeNumericValue(value: string, config: NumericFieldConfig): string {
	let sanitized = value.replace(/,/g, '.').replace(/[^\d+\-.]/g, '');
	sanitized = sanitized.replace(/\+/g, '');

	const isNegative = config.allowNegative && sanitized.startsWith('-');
	sanitized = sanitized.replace(/-/g, '');
	if (isNegative) {
		sanitized = `-${sanitized}`;
	}

	if (config.allowDecimal) {
		const [whole, ...rest] = sanitized.split('.');
		const fraction = rest.join('').slice(0, config.decimals);
		sanitized = rest.length > 0 ? `${whole}.${fraction}` : whole;
	} else {
		sanitized = sanitized.replace(/\./g, '');
	}

	return sanitized;
}

export function handleNumericKeydown(field: NumericField, event: KeyboardEvent): void {
	if (event.ctrlKey || event.metaKey || event.altKey || EDITING_KEYS.has(event.key)) {
		return;
	}

	const config = getNumericFieldConfig(field);
	const input = event.currentTarget as HTMLInputElement;

	if (/^\d$/.test(event.key)) {
		return;
	}

	if (event.key === '.') {
		if (!config.allowDecimal) {
			event.preventDefault();
			return;
		}

		const selectionStart = input.selectionStart ?? 0;
		const selectionEnd = input.selectionEnd ?? 0;
		const nextValue = input.value.slice(0, selectionStart) + input.value.slice(selectionEnd);
		if (nextValue.includes('.')) {
			event.preventDefault();
		}
		return;
	}

	if (event.key === '-') {
		if (!config.allowNegative) {
			event.preventDefault();
			return;
		}

		const selectionStart = input.selectionStart ?? 0;
		const selectionEnd = input.selectionEnd ?? 0;
		const nextValue = input.value.slice(0, selectionStart) + input.value.slice(selectionEnd);
		if (selectionStart !== 0 || nextValue.includes('-')) {
			event.preventDefault();
		}
		return;
	}

	event.preventDefault();
}

export function handleNumericInput(
	data: PrescriptionFormData,
	field: NumericField,
	event: Event
): void {
	const input = event.currentTarget as HTMLInputElement;
	const sanitized = sanitizeNumericValue(input.value, getNumericFieldConfig(field));
	data[field] = sanitized;
	if (input.value !== sanitized) {
		input.value = sanitized;
	}
}

export function normalizeNumericField(data: PrescriptionFormData, field: NumericField): void {
	const config = getNumericFieldConfig(field);
	const sanitized = sanitizeNumericValue(data[field].trim(), config);

	if (sanitized === '' || sanitized === '-' || sanitized === '.' || sanitized === '-.') {
		data[field] = '';
		return;
	}

	const parsed = Number(sanitized);
	if (Number.isNaN(parsed)) {
		data[field] = sanitized;
		return;
	}

	if (config.decimals === 0) {
		data[field] = Number.isInteger(parsed) ? String(parsed) : sanitized;
		return;
	}

	data[field] = Math.round(parsed * 100) % 25 === 0 ? parsed.toFixed(config.decimals) : sanitized;
}
