/**
 * Common date schemas + EmptySchema
 * Split from schemas/common.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { z } from 'zod';
import { fromISODate, fromISO } from '$lib/dates';

export const EmptySchema = z.object({});

// =============================================================================
// DATE TRANSFORMERS (for data coming FROM the DB / API)
// =============================================================================

/**
 * Transform an ISO datetime string into a Date object.
 * Use for timestamptz columns (createdAt, updatedAt, etc.)
 */
export const isoToDate = z.iso.datetime().transform((s) => fromISO(s));

/**
 * Same as isoToDate but allows null values (optional/nullable date columns).
 */
export const isoToDateNullable = isoToDate.nullable();

/**
 * Transform a date-only string (YYYY-MM-DD) into a Date at local midnight.
 * Use for date-only columns (birthDate, prescriptionDate, effectiveDate, etc.)
 * and form date inputs. Avoids the UTC-midnight off-by-one bug.
 */
export const isoToLocalDate = z.iso.date().transform((s) => fromISODate(s)!);
