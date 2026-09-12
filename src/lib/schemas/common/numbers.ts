/**
 * Common coerced number schemas
 * Split from schemas/common.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { z } from 'zod';

/**
 * CoercedNumber schema - accepts string or number, transforms to number
 */
export const CoercedNumber = z.coerce.number<number | string>();

/**
 * CoercedInteger schema - accepts string or number, transforms to integer
 */
export const CoercedInteger = CoercedNumber.int();

interface OptionalCoercedNumberOptions {
	min?: number;
	max?: number;
	invalidMessage?: string;
	integerMessage?: string;
	minMessage?: string;
	maxMessage?: string;
}

function getOptionalNumberErrorMessage(
	options: OptionalCoercedNumberOptions | undefined,
	enforceInteger: boolean
) {
	if (enforceInteger) {
		return options?.integerMessage ?? options?.invalidMessage ?? 'Debe ser un número entero válido';
	}

	return options?.invalidMessage ?? 'Debe ser un número válido';
}

function parseOptionalNumber(
	value: unknown,
	ctx: z.RefinementCtx,
	options: OptionalCoercedNumberOptions | undefined,
	enforceInteger: boolean
): number | undefined | typeof z.NEVER {
	if (value === '' || value === null || value === undefined) {
		return undefined;
	}

	if (typeof value === 'string' && value.trim() === '') {
		return undefined;
	}

	if (typeof value !== 'string' && typeof value !== 'number') {
		ctx.addIssue({
			code: 'custom',
			message: getOptionalNumberErrorMessage(options, enforceInteger)
		});
		return z.NEVER;
	}

	const parsed = typeof value === 'string' ? Number(value.trim()) : value;
	if (!Number.isFinite(parsed)) {
		ctx.addIssue({
			code: 'custom',
			message: getOptionalNumberErrorMessage(options, enforceInteger)
		});
		return z.NEVER;
	}

	if (enforceInteger && !Number.isInteger(parsed)) {
		ctx.addIssue({
			code: 'custom',
			message: options?.integerMessage ?? 'Debe ser un número entero válido'
		});
		return z.NEVER;
	}

	if (options?.min !== undefined && parsed < options.min) {
		ctx.addIssue({
			code: 'custom',
			message: options.minMessage ?? `Debe ser mayor o igual a ${options.min}`
		});
		return z.NEVER;
	}

	if (options?.max !== undefined && parsed > options.max) {
		ctx.addIssue({
			code: 'custom',
			message: options.maxMessage ?? `Debe ser menor o igual a ${options.max}`
		});
		return z.NEVER;
	}

	return parsed;
}

/**
 * Factory for optional coerced integer schemas
 * Converts empty string, null, or undefined to undefined (no value provided)
 * This allows distinguishing between "user didn't enter anything" and "user entered 0"
 *
 * @param options - Optional min/max constraints
 * @returns A zod schema that outputs number | undefined
 *
 * @example
 * const DpSchema = OptionalCoercedInteger({ min: 10, max: 80 });
 * DpSchema.safeParse(''); // => undefined
 * DpSchema.safeParse('0'); // => 0
 */
export const OptionalCoercedInteger = (options?: OptionalCoercedNumberOptions) => {
	return z
		.any()
		.optional()
		.transform((value, ctx): number | undefined => {
			const parsed = parseOptionalNumber(value, ctx, options, true);
			return parsed === z.NEVER ? undefined : parsed;
		});
};

/**
 * Factory for optional coerced number schemas
 * Converts empty string, null, or undefined to undefined (no value provided)
 */
export const OptionalCoercedNumber = (options?: OptionalCoercedNumberOptions) => {
	return z
		.any()
		.optional()
		.transform((value, ctx): number | undefined => {
			const parsed = parseOptionalNumber(value, ctx, options, false);
			return parsed === z.NEVER ? undefined : parsed;
		});
};

/**
 * CoercedBoolean schema - accepts string or boolean, transforms to boolean
 * Handles form inputs like 'on', 'true', true
 */
export const CoercedBoolean = z.preprocess((val: boolean | string) => {
	if (typeof val === 'boolean') return val;
	if (val === 'on' || val === 'true') return true;
	if (val === 'off' || val === 'false') return false;
	return val;
}, z.boolean());
