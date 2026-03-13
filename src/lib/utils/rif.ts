/**
 * Venezuelan ID Document Prefixes & RIF Validation
 *
 * Document prefixes (V, E, J, G) are shared across:
 * - Cédula / Document IDs for customers (V = Venezuelan, E = Foreigner)
 * - RIF (Registro Único de Información Fiscal) for tax purposes (J = Juridic, G = Government)
 *
 * RIF format: X-XXXXXXXX-X (prefix + 8 digits + check digit)
 */

/** Valid Venezuelan document type prefixes (shared by cédula and RIF) */
export const ID_DOC_PREFIXES = ['V', 'E', 'J', 'G'] as const;
export type IdDocPrefix = (typeof ID_DOC_PREFIXES)[number];

/** Regex character class for ID_DOC_PREFIXES, e.g. "[VEJG]" */
const PREFIX_CLASS = `[${ID_DOC_PREFIXES.join('')}]`;

/** Matches a full RIF: captures (prefix)(8 digits)(check digit). Dashes optional. */
export const RIF_RE = new RegExp(`^(${PREFIX_CLASS})-?(\\d{8})-?(\\d)$`);

/** Matches a strict RIF with dashes: X-XXXXXXXX-X (no capture groups) */
export const RIF_STRICT_RE = new RegExp(`^${PREFIX_CLASS}-\\d{8}-\\d$`);

/** Matches an ID number: captures (prefix)(6-10 digits) */
export const ID_NUMBER_RE = new RegExp(`^(${PREFIX_CLASS})-(\\d{1,10})$`);

/** Matches a strict ID number: X-XXXXXX..X (6-10 digits, no capture groups) */
export const ID_NUMBER_STRICT_RE = new RegExp(`^${PREFIX_CLASS}-\\d{6,10}$`);

/** RIF type multipliers for Module 11 calculation */
const RIF_TYPE_VALUES: Record<IdDocPrefix, number> = {
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
export function calculateRifCheckDigit(rifType: IdDocPrefix, digits: string): number {
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
	const match = rif.toUpperCase().match(RIF_RE);
	if (!match) return false;

	const [, type, digits, checkDigitStr] = match;
	const rifType = type as IdDocPrefix;
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

	const match = rif.toUpperCase().match(RIF_RE);
	if (!match) return null;

	const [, type, digits, checkDigit] = match;
	return `${type}-${digits}-${checkDigit}`;
}

/**
 * Normalize an ID number to standard uppercase format.
 * e.g. "v-27783554" → "V-27783554"
 */
export function normalizeIdNumber(idNumber: string): string {
	return idNumber.trim().toUpperCase();
}
