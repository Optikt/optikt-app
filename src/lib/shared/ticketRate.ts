/**
 * Resolve the effective BCV rate for a tickera receipt in Bs.
 *
 * The sale snapshot (frozen at submit time) wins so reprints days later are
 * identical. Pre-feature sales have NULL snapshot and fall back to the live
 * rate. Returns null only when neither is usable (caller errors as before).
 */
export function resolveTicketRate(
	snapshotBcvRate: number | null | undefined,
	liveBcvRate: number | null | undefined
): number | null {
	if (snapshotBcvRate !== null && snapshotBcvRate !== undefined && snapshotBcvRate > 0) {
		return snapshotBcvRate;
	}
	if (liveBcvRate !== null && liveBcvRate !== undefined && liveBcvRate > 0) {
		return liveBcvRate;
	}
	return null;
}
