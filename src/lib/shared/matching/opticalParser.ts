import type { EyePrescription, PrescriptionForMatching } from './types';

// ============================================================================
// OPTICAL PRESCRIPTION PARSER
// ============================================================================

const DIOPTER_PATTERN = /[+-]\d+(?:\.\d{1,2})?/g;
const EYE_PREFIX = /^(od|oi|os)\s*:\s*/i;

interface SingleEyeParseResult {
	eye: 'od' | 'os';
	prescription: EyePrescription;
}

/**
 * Parse a single eye segment like "+3.50 -2.00" or "+3.50 -2.00 +2.00"
 * into sphere/cylinder/addition values.
 *
 * Rules:
 * - 1 value: sphere only
 * - 2 values: sphere, cylinder
 * - 3 values: sphere, cylinder, addition
 */
function parseDiopters(text: string): EyePrescription | null {
	const matches = text.match(DIOPTER_PATTERN);
	if (!matches || matches.length === 0) return null;

	const values = matches.map((m) => parseFloat(m));

	return {
		sphere: values[0] ?? null,
		cylinder: values.length >= 2 ? (values[1] ?? null) : null,
		addition: values.length >= 3 ? (values[2] ?? null) : null
	};
}

/**
 * Parse a single "OD:+3.50 -2.00" or "OI:+1.00 -0.50 +2.00" segment.
 */
function parseEyeSegment(segment: string): SingleEyeParseResult | null {
	const trimmed = segment.trim();
	const prefixMatch = trimmed.match(EYE_PREFIX);
	if (!prefixMatch) return null;

	const rawEye = prefixMatch[1]!.toLowerCase();
	const eye: 'od' | 'os' = rawEye === 'od' ? 'od' : 'os'; // OI/OS both map to OS
	const rest = trimmed.slice(prefixMatch[0].length);

	const prescription = parseDiopters(rest);
	if (!prescription) return null;

	return { eye, prescription };
}

export interface PrescriptionParseResult {
	prescription: PrescriptionForMatching | null;
	/** Raw text for fallback search */
	text: string;
	/** Whether any optical data was parsed */
	isOptical: boolean;
	/** Whether OD/OS segments were found */
	hasPrefixes: boolean;
}

const EMPTY_EYE: EyePrescription = { sphere: null, cylinder: null, addition: null };

/**
 * Parse a prescription string that may contain OD/OI/OS prefixes.
 *
 * Supported formats:
 * - "od:+3.50 -2.00 oi:+1.00 -0.50"        → binocular
 * - "od:+3.50 -2.00"                         → monocular OD only
 * - "oi:-0.50 -0.50 +2.00"                   → monocular OS with addition
 * - "+3.50 -2.00"                            → unprefixed (both eyes same)
 * - "os:+1.00 -0.50"                         → OS alias for OI
 *
 * Returns null prescription when input doesn't contain optical data.
 */
export function parseOpticalPrescription(input: string): PrescriptionParseResult {
	const trimmed = input.trim();
	if (!trimmed) {
		return { prescription: null, text: '', isOptical: false, hasPrefixes: false };
	}

	// Split by eye prefixes — find all OD/OI/OS segments
	// Use a lookahead split: split before each eye prefix
	const segments = trimmed.split(/(?=\b(?:od|oi|os)\s*:)/i).filter((s) => s.trim());

	const hasPrefix = segments.some((s) => EYE_PREFIX.test(s.trim()));

	if (hasPrefix) {
		let od: EyePrescription = { ...EMPTY_EYE };
		let os: EyePrescription = { ...EMPTY_EYE };

		for (const seg of segments) {
			const parsed = parseEyeSegment(seg);
			if (!parsed) continue;
			if (parsed.eye === 'od') od = parsed.prescription;
			else os = parsed.prescription;
		}

		// At least one eye must have data
		const hasData =
			od.sphere !== null || od.cylinder !== null || os.sphere !== null || os.cylinder !== null;

		return {
			prescription: hasData ? { od, os } : null,
			text: trimmed,
			isOptical: hasData,
			hasPrefixes: true
		};
	}

	// No prefixes — try to parse as a single set of diopter values (applied to both eyes)
	const single = parseDiopters(trimmed);
	if (single && single.sphere !== null) {
		return {
			prescription: { od: single, os: { ...single } },
			text: trimmed,
			isOptical: true,
			hasPrefixes: false
		};
	}

	return { prescription: null, text: trimmed, isOptical: false, hasPrefixes: false };
}
