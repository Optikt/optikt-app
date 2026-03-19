import { describe, it, expect } from 'vitest';
import { SurplusUnitStatus } from '$lib/shared/contracts/fulfillment';
import { isValidTransition, getValidTransitionsFrom, isTerminalStatus } from './surplusLifecycle';

// ===========================================================================
// State transition validation
// ===========================================================================

describe('surplus lifecycle — state transitions', () => {
	// --- AVAILABLE transitions ---
	it('AVAILABLE → RESERVED is valid', () => {
		expect(isValidTransition(SurplusUnitStatus.AVAILABLE, SurplusUnitStatus.RESERVED)).toBe(true);
	});

	it('AVAILABLE → VOID is valid', () => {
		expect(isValidTransition(SurplusUnitStatus.AVAILABLE, SurplusUnitStatus.VOID)).toBe(true);
	});

	it('AVAILABLE → CONSUMED is invalid (must reserve first)', () => {
		expect(isValidTransition(SurplusUnitStatus.AVAILABLE, SurplusUnitStatus.CONSUMED)).toBe(false);
	});

	it('AVAILABLE → AVAILABLE is invalid (no self-transition)', () => {
		expect(isValidTransition(SurplusUnitStatus.AVAILABLE, SurplusUnitStatus.AVAILABLE)).toBe(false);
	});

	// --- RESERVED transitions ---
	it('RESERVED → CONSUMED is valid (sale confirmed)', () => {
		expect(isValidTransition(SurplusUnitStatus.RESERVED, SurplusUnitStatus.CONSUMED)).toBe(true);
	});

	it('RESERVED → AVAILABLE is valid (release back)', () => {
		expect(isValidTransition(SurplusUnitStatus.RESERVED, SurplusUnitStatus.AVAILABLE)).toBe(true);
	});

	it('RESERVED → VOID is valid (damaged while reserved)', () => {
		expect(isValidTransition(SurplusUnitStatus.RESERVED, SurplusUnitStatus.VOID)).toBe(true);
	});

	it('RESERVED → RESERVED is invalid (no self-transition)', () => {
		expect(isValidTransition(SurplusUnitStatus.RESERVED, SurplusUnitStatus.RESERVED)).toBe(false);
	});

	// --- CONSUMED terminal ---
	it('CONSUMED → any is invalid (terminal state)', () => {
		expect(isValidTransition(SurplusUnitStatus.CONSUMED, SurplusUnitStatus.AVAILABLE)).toBe(false);
		expect(isValidTransition(SurplusUnitStatus.CONSUMED, SurplusUnitStatus.RESERVED)).toBe(false);
		expect(isValidTransition(SurplusUnitStatus.CONSUMED, SurplusUnitStatus.VOID)).toBe(false);
	});

	// --- VOID terminal ---
	it('VOID → any is invalid (terminal state)', () => {
		expect(isValidTransition(SurplusUnitStatus.VOID, SurplusUnitStatus.AVAILABLE)).toBe(false);
		expect(isValidTransition(SurplusUnitStatus.VOID, SurplusUnitStatus.RESERVED)).toBe(false);
		expect(isValidTransition(SurplusUnitStatus.VOID, SurplusUnitStatus.CONSUMED)).toBe(false);
	});
});

// ===========================================================================
// Helper functions
// ===========================================================================

describe('surplus lifecycle — helpers', () => {
	it('getValidTransitionsFrom AVAILABLE returns RESERVED and VOID', () => {
		const transitions = getValidTransitionsFrom(SurplusUnitStatus.AVAILABLE);
		expect(transitions).toContain(SurplusUnitStatus.RESERVED);
		expect(transitions).toContain(SurplusUnitStatus.VOID);
		expect(transitions).toHaveLength(2);
	});

	it('getValidTransitionsFrom RESERVED returns CONSUMED, AVAILABLE, VOID', () => {
		const transitions = getValidTransitionsFrom(SurplusUnitStatus.RESERVED);
		expect(transitions).toContain(SurplusUnitStatus.CONSUMED);
		expect(transitions).toContain(SurplusUnitStatus.AVAILABLE);
		expect(transitions).toContain(SurplusUnitStatus.VOID);
		expect(transitions).toHaveLength(3);
	});

	it('getValidTransitionsFrom CONSUMED returns empty (terminal)', () => {
		expect(getValidTransitionsFrom(SurplusUnitStatus.CONSUMED)).toHaveLength(0);
	});

	it('getValidTransitionsFrom VOID returns empty (terminal)', () => {
		expect(getValidTransitionsFrom(SurplusUnitStatus.VOID)).toHaveLength(0);
	});

	it('CONSUMED and VOID are terminal states', () => {
		expect(isTerminalStatus(SurplusUnitStatus.CONSUMED)).toBe(true);
		expect(isTerminalStatus(SurplusUnitStatus.VOID)).toBe(true);
	});

	it('AVAILABLE and RESERVED are not terminal states', () => {
		expect(isTerminalStatus(SurplusUnitStatus.AVAILABLE)).toBe(false);
		expect(isTerminalStatus(SurplusUnitStatus.RESERVED)).toBe(false);
	});
});
