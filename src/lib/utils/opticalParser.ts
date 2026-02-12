/**
 * Optical parameter parser
 *
 * Parses prescription-style input into sphere/cylinder/addition values.
 * Handles formats like:
 *   "+3.50 -2.00"       → sphere: 3.50, cylinder: -2.00
 *   "+3.50"             → sphere: 3.50
 *   "-2.50 -1.25 +2.00" → sphere: -2.50, cylinder: -1.25, addition: 2.00
 *   "+0.25 -0.50"       → sphere: 0.25, cylinder: -0.50
 */

export interface OpticalParams {
	sphere?: number;
	cylinder?: number;
	addition?: number;
}

export interface ParseResult {
	/** Parsed optical parameters (null if input is plain text) */
	optical: OpticalParams | null;
	/** Original text (for fallback text search) */
	text: string;
	/** Whether optical params were detected */
	isOptical: boolean;
}

/**
 * Detect if a string contains optical parameter patterns.
 * Optical patterns are numbers with explicit +/- signs, often with decimal parts.
 */
const OPTICAL_NUMBER = /[+-]\d+(?:\.\d{1,2})?/g;

export function parseOpticalInput(input: string): ParseResult {
	const trimmed = input.trim();
	if (!trimmed) {
		return { optical: null, text: '', isOptical: false };
	}

	// Find all optical-style numbers (+X.XX or -X.XX)
	const matches = trimmed.match(OPTICAL_NUMBER);

	if (!matches || matches.length === 0) {
		return { optical: null, text: trimmed, isOptical: false };
	}

	const values = matches.map((m) => parseFloat(m));
	const params: OpticalParams = {};

	// First value is always sphere
	params.sphere = values[0];

	// Second value: if negative, it's cylinder; if positive, could be addition
	if (values.length >= 2) {
		if (values[1] <= 0) {
			params.cylinder = values[1];
		} else {
			// Positive second value with no cylinder → this is just another sphere search
			// unless there's a third value (then second is cylinder somehow)
			params.cylinder = values[1];
		}
	}

	// Third value is addition
	if (values.length >= 3) {
		params.addition = values[2];
	}

	return {
		optical: params,
		text: trimmed,
		isOptical: true
	};
}
