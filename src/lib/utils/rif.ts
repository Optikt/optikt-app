/**
 * Venezuelan RIF (Registro Único de Información Fiscal) Validation
 *
 * RIF format: X-XXXXXXXX-X
 * - First letter: V (Venezuelan), E (Foreign), J (Legal entity), G (Government)
 * - 8 digits: ID number
 * - 1 digit: Check digit calculated using Module 11 algorithm
 */

/** Valid RIF type letters */
export const RIF_TYPES = ['V', 'E', 'J', 'G'] as const;
export type RifType = (typeof RIF_TYPES)[number];

/** RIF type multipliers for Module 11 calculation */
const RIF_TYPE_VALUES: Record<RifType, number> = {
	V: 1,
	E: 2,
	J: 3,
	G: 4
};

/** Module 11 weights for each position (type + 8 digits) */
const WEIGHTS = [4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Calculate the check digit using Module 11 algorithm
 * @param rifType - The RIF type letter (V, E, J, G)
 * @param digits - The 8-digit number as string
 * @returns The calculated check digit (0-9)
 */
export function calculateRifCheckDigit(rifType: RifType, digits: string): number {
	// Ensure we have exactly 8 digits
	const cleanDigits = digits.replace(/\D/g, '').slice(0, 8);
	if (cleanDigits.length !== 8) {
		throw new Error('RIF must have exactly 8 digits');
	}

	// Build array: [type value, d1, d2, d3, d4, d5, d6, d7, d8]
	const values = [RIF_TYPE_VALUES[rifType], ...cleanDigits.split('').map(Number)];

	// Calculate weighted sum
	let sum = 0;
	for (let i = 0; i < WEIGHTS.length; i++) {
		sum += values[i] * WEIGHTS[i];
	}

	// Module 11 calculation
	const remainder = sum % 11;
	const checkDigit = 11 - remainder;

	// Handle special cases: 10 -> 0, 11 -> 0
	return checkDigit >= 10 ? 0 : checkDigit;
}

/**
 * Validate a complete RIF string
 * @param rif - The complete RIF string (e.g., "J-12345678-9" or "J123456789")
 * @returns true if valid, false if invalid
 */
export function validateRif(rif: string): boolean {
	if (!rif) return false;

	// Parse RIF - accepts with or without dashes
	const match = rif.toUpperCase().match(/^([VEJG])-?(\d{8})-?(\d)$/);
	if (!match) return false;

	const [, type, digits, checkDigitStr] = match;
	const rifType = type as RifType;
	const providedCheckDigit = parseInt(checkDigitStr, 10);

	// Calculate expected check digit
	const expectedCheckDigit = calculateRifCheckDigit(rifType, digits);

	return providedCheckDigit === expectedCheckDigit;
}

/**
 * Format a RIF string to standard format: X-XXXXXXXX-X
 * @param rif - Raw RIF string
 * @returns Formatted RIF or null if invalid format
 */
export function formatRif(rif: string): string | null {
	if (!rif) return null;

	const match = rif.toUpperCase().match(/^([VEJG])-?(\d{8})-?(\d)$/);
	if (!match) return null;

	const [, type, digits, checkDigit] = match;
	return `${type}-${digits}-${checkDigit}`;
}
