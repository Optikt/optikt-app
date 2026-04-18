import { describe, it, expect } from 'vitest';
import { planFifoConsumption, type FifoLotInput } from './inventory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lot(id: string, qty: number, price: number): FifoLotInput {
	return { id, quantityAvailable: qty, unitPurchasePrice: price };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('planFifoConsumption', () => {
	// ── Happy paths ──────────────────────────────────────────────────────

	it('consumes entirely from a single lot', () => {
		const lots = [lot('A', 10, 50)];
		const plan = planFifoConsumption(lots, 5);

		expect(plan.allocations).toHaveLength(1);
		expect(plan.allocations[0]).toEqual({
			lotId: 'A',
			quantityToConsume: 5,
			unitPurchasePrice: 50,
			quantityBeforeConsume: 10,
			quantityAfterConsume: 5
		});
		expect(plan.primaryLotId).toBe('A');
		expect(plan.primaryPurchasePrice).toBe(50);
	});

	it('depletes a lot completely when quantity matches availability', () => {
		const lots = [lot('A', 3, 20)];
		const plan = planFifoConsumption(lots, 3);

		expect(plan.allocations).toHaveLength(1);
		expect(plan.allocations[0].quantityAfterConsume).toBe(0);
	});

	it('spans two lots when first is insufficient', () => {
		const lots = [lot('A', 2, 10), lot('B', 5, 15)];
		const plan = planFifoConsumption(lots, 4);

		expect(plan.allocations).toHaveLength(2);
		expect(plan.allocations[0]).toEqual({
			lotId: 'A',
			quantityToConsume: 2,
			unitPurchasePrice: 10,
			quantityBeforeConsume: 2,
			quantityAfterConsume: 0
		});
		expect(plan.allocations[1]).toEqual({
			lotId: 'B',
			quantityToConsume: 2,
			unitPurchasePrice: 15,
			quantityBeforeConsume: 5,
			quantityAfterConsume: 3
		});
		// Primary lot is always the oldest (first in FIFO order)
		expect(plan.primaryLotId).toBe('A');
		expect(plan.primaryPurchasePrice).toBe(10);
	});

	it('spans three lots for a large quantity', () => {
		const lots = [lot('A', 1, 5), lot('B', 2, 10), lot('C', 10, 20)];
		const plan = planFifoConsumption(lots, 5);

		expect(plan.allocations).toHaveLength(3);
		expect(plan.allocations[0].quantityToConsume).toBe(1); // A fully depleted
		expect(plan.allocations[1].quantityToConsume).toBe(2); // B fully depleted
		expect(plan.allocations[2].quantityToConsume).toBe(2); // C partial
		expect(plan.allocations[2].quantityAfterConsume).toBe(8);
		expect(plan.primaryLotId).toBe('A');
	});

	it('depletes all lots exactly when quantity equals total available', () => {
		const lots = [lot('A', 3, 10), lot('B', 7, 20)];
		const plan = planFifoConsumption(lots, 10);

		expect(plan.allocations).toHaveLength(2);
		expect(plan.allocations[0].quantityAfterConsume).toBe(0);
		expect(plan.allocations[1].quantityAfterConsume).toBe(0);
	});

	it('skips lots with zero availability', () => {
		// A depleted lot shouldn't normally appear (getActiveLotsFifo filters them),
		// but planFifoConsumption should handle it gracefully
		const lots = [lot('A', 0, 10), lot('B', 5, 20)];
		const plan = planFifoConsumption(lots, 3);

		// A contributes nothing, B fulfills the request
		expect(plan.allocations).toHaveLength(1);
		expect(plan.allocations[0].lotId).toBe('B');
		expect(plan.primaryLotId).toBe('B');
	});

	it('quantity of 1 consumes from the oldest lot', () => {
		const lots = [lot('A', 10, 100), lot('B', 10, 200)];
		const plan = planFifoConsumption(lots, 1);

		expect(plan.allocations).toHaveLength(1);
		expect(plan.allocations[0].lotId).toBe('A');
		expect(plan.primaryPurchasePrice).toBe(100);
	});

	// ── Primary lot / purchase price ─────────────────────────────────────

	it('primary purchase price reflects the oldest lot, not the cheapest', () => {
		// FIFO ≠ lowest cost - the oldest lot may be more expensive
		const lots = [lot('expensive-old', 5, 999), lot('cheap-new', 5, 1)];
		const plan = planFifoConsumption(lots, 3);

		expect(plan.primaryLotId).toBe('expensive-old');
		expect(plan.primaryPurchasePrice).toBe(999);
	});

	// ── Edge cases ───────────────────────────────────────────────────────

	it('throws when quantity is 0', () => {
		const lots = [lot('A', 10, 50)];
		expect(() => planFifoConsumption(lots, 0)).toThrow('La cantidad debe ser mayor a 0');
	});

	it('throws when quantity is negative', () => {
		const lots = [lot('A', 10, 50)];
		expect(() => planFifoConsumption(lots, -1)).toThrow('La cantidad debe ser mayor a 0');
	});

	it('throws when lots are empty', () => {
		expect(() => planFifoConsumption([], 1)).toThrow('Stock en lotes insuficiente');
	});

	it('throws when total lot stock is insufficient', () => {
		const lots = [lot('A', 2, 10), lot('B', 3, 20)];
		expect(() => planFifoConsumption(lots, 6)).toThrow(
			'Stock en lotes insuficiente. Disponible: 5, solicitado: 6'
		);
	});

	it('throws when lots exist but all have zero quantity', () => {
		const lots = [lot('A', 0, 10), lot('B', 0, 20)];
		expect(() => planFifoConsumption(lots, 1)).toThrow('Stock en lotes insuficiente');
	});

	// ── Allocation correctness ───────────────────────────────────────────

	it('total consumed across allocations equals the requested quantity', () => {
		const lots = [lot('A', 3, 10), lot('B', 4, 20), lot('C', 5, 30)];
		const plan = planFifoConsumption(lots, 7);

		const totalConsumed = plan.allocations.reduce((s, a) => s + a.quantityToConsume, 0);
		expect(totalConsumed).toBe(7);
	});

	it('quantityAfterConsume is always non-negative', () => {
		const lots = [lot('A', 1, 10), lot('B', 1, 20), lot('C', 1, 30)];
		const plan = planFifoConsumption(lots, 3);

		for (const alloc of plan.allocations) {
			expect(alloc.quantityAfterConsume).toBeGreaterThanOrEqual(0);
		}
	});

	it('does not touch lots beyond what is needed', () => {
		const lots = [lot('A', 5, 10), lot('B', 5, 20), lot('C', 5, 30)];
		const plan = planFifoConsumption(lots, 3);

		// Only lot A should be touched
		expect(plan.allocations).toHaveLength(1);
		expect(plan.allocations[0].lotId).toBe('A');
	});

	it('preserves lot order - never skips to a later lot with more stock', () => {
		// A has 1, B has 100 - FIFO should still start with A
		const lots = [lot('A', 1, 50), lot('B', 100, 10)];
		const plan = planFifoConsumption(lots, 2);

		expect(plan.allocations[0].lotId).toBe('A');
		expect(plan.allocations[0].quantityToConsume).toBe(1);
		expect(plan.allocations[1].lotId).toBe('B');
		expect(plan.allocations[1].quantityToConsume).toBe(1);
	});

	// ── Cost aggregates ──────────────────────────────────────────────────

	it('costTotal and costUnit are correct for single lot', () => {
		const lots = [lot('A', 10, 50)];
		const plan = planFifoConsumption(lots, 5);

		// 5 × 50 = 250
		expect(plan.costTotal).toBe(250);
		expect(plan.costUnit).toBe(50);
		expect(plan.lotsCount).toBe(1);
	});

	it('costTotal and costUnit are correct for multi-lot consumption', () => {
		// Lot A: 2 units at $10, Lot B: 5 units at $15
		// Consume 4: 2×10 + 2×15 = 20 + 30 = 50, avg = 50/4 = 12.5
		const lots = [lot('A', 2, 10), lot('B', 5, 15)];
		const plan = planFifoConsumption(lots, 4);

		expect(plan.costTotal).toBe(50);
		expect(plan.costUnit).toBe(12.5);
		expect(plan.lotsCount).toBe(2);
	});

	it('costTotal and costUnit for three lots', () => {
		// A: 1×5=5, B: 2×10=20, C: 2×20=40 → total=65, qty=5, avg=13
		const lots = [lot('A', 1, 5), lot('B', 2, 10), lot('C', 10, 20)];
		const plan = planFifoConsumption(lots, 5);

		expect(plan.costTotal).toBe(65);
		expect(plan.costUnit).toBe(13);
		expect(plan.lotsCount).toBe(3);
	});

	it('lotsCount is 1 when consuming from a single lot', () => {
		const lots = [lot('A', 10, 100), lot('B', 10, 200)];
		const plan = planFifoConsumption(lots, 3);

		expect(plan.lotsCount).toBe(1);
	});
});
