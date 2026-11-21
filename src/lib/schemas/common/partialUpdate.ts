import { z } from 'zod';

/**
 * `Update*` schema builder (DT26): like `schema.partial()` but **without the
 * `.default()`s** of the create schema.
 *
 * Zod 4 keeps defaults inside `.partial()` (`{a: z.boolean().default(true)}`
 * parses `{}` as `{a: true}`), so a partial update would silently reset every
 * defaulted field the caller did not send. Here an omitted key stays `undefined`
 * ("do not touch"); pair it with `buildChangedFields` in the remote.
 */
export function partialUpdate<T extends z.ZodRawShape>(
	schema: z.ZodObject<T>
): ReturnType<z.ZodObject<T>['partial']> {
	const shape: Record<string, z.ZodType> = {};
	for (const [key, field] of Object.entries(schema.shape)) {
		shape[key] = stripDefault(field as z.ZodType);
	}
	return z.object(shape).partial() as unknown as ReturnType<z.ZodObject<T>['partial']>;
}

/** Removes `.default()` wrappers, also when nested in optional/nullable/pipe/transform. */
function stripDefault(field: z.ZodType): z.ZodType {
	if (field instanceof z.ZodDefault) {
		return stripDefault(field.unwrap() as z.ZodType);
	}
	if (field instanceof z.ZodOptional) {
		return stripDefault(field.unwrap() as z.ZodType).optional();
	}
	if (field instanceof z.ZodNullable) {
		return stripDefault(field.unwrap() as z.ZodType).nullable();
	}
	if (field instanceof z.ZodPipe) {
		const inner = stripDefault(field.in as z.ZodType);
		return inner === field.in ? field : z.pipe(inner, field.out as z.ZodType);
	}
	return field;
}
