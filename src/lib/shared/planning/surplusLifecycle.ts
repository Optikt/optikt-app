import { SurplusUnitStatus } from '$lib/shared/contracts/fulfillment';

/**
 * Valid state transitions for surplus units.
 *
 * AVAILABLE → RESERVED (sale locks it)
 * AVAILABLE → VOID (damaged/lost/correction)
 * RESERVED → CONSUMED (sale confirmed)
 * RESERVED → AVAILABLE (sale cancelled, plan changed)
 * RESERVED → VOID (damaged while reserved)
 * CONSUMED → AVAILABLE (sale cancelled — unit was never physically used)
 */
const VALID_TRANSITIONS: ReadonlyMap<SurplusUnitStatus, readonly SurplusUnitStatus[]> = new Map([
	[SurplusUnitStatus.AVAILABLE, [SurplusUnitStatus.RESERVED, SurplusUnitStatus.VOID]],
	[
		SurplusUnitStatus.RESERVED,
		[SurplusUnitStatus.CONSUMED, SurplusUnitStatus.AVAILABLE, SurplusUnitStatus.VOID]
	],
	[SurplusUnitStatus.CONSUMED, [SurplusUnitStatus.AVAILABLE]],
	[SurplusUnitStatus.VOID, []]
]);

export function isValidTransition(from: SurplusUnitStatus, to: SurplusUnitStatus): boolean {
	return VALID_TRANSITIONS.get(from)?.includes(to) ?? false;
}

export function getValidTransitionsFrom(status: SurplusUnitStatus): readonly SurplusUnitStatus[] {
	return VALID_TRANSITIONS.get(status) ?? [];
}

export function isTerminalStatus(status: SurplusUnitStatus): boolean {
	return status === SurplusUnitStatus.VOID;
}
