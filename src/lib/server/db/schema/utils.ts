/**
 * Convert a TypeScript string enum to the tuple format Drizzle's pgEnum expects.
 */
export const enumValues = <T extends Record<string, string>>(e: T) =>
	Object.values(e) as [string, ...string[]];
