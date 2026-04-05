/**
 * FIFO E2E Scenario Tests
 *
 * Tests the full FIFO lifecycle: create lots → sell → verify stock → cancel → verify rollback.
 * Uses planFifoConsumption as the core engine with in-memory lot state tracking.
 * Covers single-lot, multi-lot, sequential sales, partial cancellation, and adjustment scenarios.
 */
import { describe, it, expect } from 'vitest';
import { planFifoConsumption, type FifoLotInput, type FifoPlan } from './inventory';

// ---------------------------------------------------------------------------
// In-memory lot simulator
// ---------------------------------------------------------------------------

interface MemoryLot {
	id: string;
	quantityInitial: number;
	quantityAvailable: number;
	unitPurchasePrice: number;
	isActive: boolean;
}

interface Movement {
	type: 'PURCHASE_IN' | 'SALE_OUT' | 'CANCEL_REVERT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
	lotId: string;
	quantityDelta: number;
	quantityBefore: number;
	quantityAfter: number;
	referenceId: string;
}

/**
 * Simulates the DB layer for FIFO operations.
 * Tracks lots, movements, and cached stock — mirrors the real DB behavior.
 */
class FifoSimulator {
	lots: MemoryLot[] = [];
	movements: Movement[] = [];
	cachedStock = 0;

	/** Simulate confirming a PO — creates lots and PURCHASE_IN movements */
	addLot(id: string, quantity: number, price: number, poId = 'po-1'): void {
		this.lots.push({
			id,
			quantityInitial: quantity,
			quantityAvailable: quantity,
			unitPurchasePrice: price,
			isActive: true
		});
		this.movements.push({
			type: 'PURCHASE_IN',
			lotId: id,
			quantityDelta: quantity,
			quantityBefore: 0,
			quantityAfter: quantity,
			referenceId: poId
		});
		this.cachedStock += quantity;
	}

	/** Get active lots in FIFO order (oldest first = insertion order) */
	getActiveLotsFifo(): FifoLotInput[] {
		return this.lots
			.filter((l) => l.isActive && l.quantityAvailable > 0)
			.map((l) => ({
				id: l.id,
				quantityAvailable: l.quantityAvailable,
				unitPurchasePrice: l.unitPurchasePrice
			}));
	}

	/** Simulate a sale: plan FIFO, consume lots, create movements, update stock */
	sell(saleId: string, quantity: number): FifoPlan {
		const activeLots = this.getActiveLotsFifo();
		const plan = planFifoConsumption(activeLots, quantity);

		for (const alloc of plan.allocations) {
			const lot = this.lots.find((l) => l.id === alloc.lotId)!;
			const before = lot.quantityAvailable;
			lot.quantityAvailable -= alloc.quantityToConsume;
			if (lot.quantityAvailable === 0) lot.isActive = false;

			this.movements.push({
				type: 'SALE_OUT',
				lotId: alloc.lotId,
				quantityDelta: -alloc.quantityToConsume,
				quantityBefore: before,
				quantityAfter: lot.quantityAvailable,
				referenceId: saleId
			});
		}

		this.cachedStock -= quantity;
		return plan;
	}

	/** Simulate cancelling a sale: find SALE_OUT movements, return to lots, create CANCEL_REVERT */
	cancelSale(saleId: string): void {
		const saleOuts = this.movements.filter(
			(m) => m.type === 'SALE_OUT' && m.referenceId === saleId
		);
		let totalReturned = 0;

		for (const movement of saleOuts) {
			const quantityToReturn = Math.abs(movement.quantityDelta);
			const lot = this.lots.find((l) => l.id === movement.lotId)!;
			const before = lot.quantityAvailable;
			lot.quantityAvailable += quantityToReturn;
			lot.isActive = true;

			this.movements.push({
				type: 'CANCEL_REVERT',
				lotId: movement.lotId,
				quantityDelta: quantityToReturn,
				quantityBefore: before,
				quantityAfter: lot.quantityAvailable,
				referenceId: saleId
			});
			totalReturned += quantityToReturn;
		}

		this.cachedStock += totalReturned;
	}

	/** Simulate a manual adjustment */
	adjust(lotId: string, delta: number, reason = 'adjustment'): void {
		const lot = this.lots.find((l) => l.id === lotId)!;
		const before = lot.quantityAvailable;
		const after = before + delta;

		if (after < 0) {
			throw new Error(
				`Ajuste inválido: disponible ${before}, delta ${delta} resultaría en ${after}`
			);
		}

		lot.quantityAvailable = after;
		lot.isActive = after > 0;

		this.movements.push({
			type: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
			lotId,
			quantityDelta: delta,
			quantityBefore: before,
			quantityAfter: after,
			referenceId: reason
		});
		this.cachedStock += delta;
	}

	/** Compute real stock from lots (source of truth) */
	computeRealStock(): number {
		return this.lots.reduce((sum, l) => sum + l.quantityAvailable, 0);
	}

	/** Find a lot by ID */
	findLot(id: string): MemoryLot | undefined {
		return this.lots.find((l) => l.id === id);
	}

	/** Get movements for a specific reference */
	getMovementsByRef(referenceId: string): Movement[] {
		return this.movements.filter((m) => m.referenceId === referenceId);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FIFO E2E Scenarios', () => {
	// ── Single-lot scenarios ─────────────────────────────────────────────

	describe('single-lot lifecycle', () => {
		it('sale consumes from lot, cancel restores fully', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 10, 50);

			// Sell 3 units
			const plan = sim.sell('sale-1', 3);
			expect(plan.allocations).toHaveLength(1);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(7);
			expect(sim.cachedStock).toBe(7);
			expect(sim.computeRealStock()).toBe(7);

			// Cancel the sale
			sim.cancelSale('sale-1');
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(10);
			expect(sim.findLot('lot-1')!.isActive).toBe(true);
			expect(sim.cachedStock).toBe(10);
			expect(sim.computeRealStock()).toBe(10);
		});

		it('sale depletes lot completely, cancel reactivates it', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 5, 30);

			sim.sell('sale-1', 5);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(0);
			expect(sim.findLot('lot-1')!.isActive).toBe(false);
			expect(sim.cachedStock).toBe(0);

			sim.cancelSale('sale-1');
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(5);
			expect(sim.findLot('lot-1')!.isActive).toBe(true);
			expect(sim.cachedStock).toBe(5);
		});

		it('multiple sales from same lot, cancel one restores partially', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 10, 50);

			sim.sell('sale-1', 3);
			sim.sell('sale-2', 4);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(3);
			expect(sim.cachedStock).toBe(3);

			// Cancel only sale-1
			sim.cancelSale('sale-1');
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(6);
			expect(sim.cachedStock).toBe(6);
		});
	});

	// ── Multi-lot scenarios ──────────────────────────────────────────────

	describe('multi-lot FIFO consumption', () => {
		it('sale spans two lots in FIFO order, cancel restores both', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 2, 10);
			sim.addLot('lot-B', 5, 15);

			const plan = sim.sell('sale-1', 4);
			expect(plan.allocations).toHaveLength(2);
			expect(plan.allocations[0].lotId).toBe('lot-A');
			expect(plan.allocations[0].quantityToConsume).toBe(2);
			expect(plan.allocations[1].lotId).toBe('lot-B');
			expect(plan.allocations[1].quantityToConsume).toBe(2);

			expect(sim.findLot('lot-A')!.quantityAvailable).toBe(0);
			expect(sim.findLot('lot-A')!.isActive).toBe(false);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(3);
			expect(sim.cachedStock).toBe(3);

			// Cancel
			sim.cancelSale('sale-1');
			expect(sim.findLot('lot-A')!.quantityAvailable).toBe(2);
			expect(sim.findLot('lot-A')!.isActive).toBe(true);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(5);
			expect(sim.cachedStock).toBe(7);
		});

		it('sale spans three lots, depletes first two completely', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 1, 5);
			sim.addLot('lot-B', 2, 10);
			sim.addLot('lot-C', 10, 20);

			const plan = sim.sell('sale-1', 5);
			expect(plan.allocations).toHaveLength(3);

			expect(sim.findLot('lot-A')!.quantityAvailable).toBe(0);
			expect(sim.findLot('lot-A')!.isActive).toBe(false);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(0);
			expect(sim.findLot('lot-B')!.isActive).toBe(false);
			expect(sim.findLot('lot-C')!.quantityAvailable).toBe(8);
			expect(sim.cachedStock).toBe(8);
		});

		it('FIFO order: oldest lot consumed first even if smaller', () => {
			const sim = new FifoSimulator();
			sim.addLot('old-small', 1, 50);
			sim.addLot('new-large', 100, 10);

			const plan = sim.sell('sale-1', 2);

			// Must consume from old-small first
			expect(plan.allocations[0].lotId).toBe('old-small');
			expect(plan.allocations[0].quantityToConsume).toBe(1);
			expect(plan.allocations[1].lotId).toBe('new-large');
			expect(plan.allocations[1].quantityToConsume).toBe(1);
		});
	});

	// ── Sequential operations ────────────────────────────────────────────

	describe('sequential sales and cancellations', () => {
		it('sequential sales deplete lots in FIFO order', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 3, 10);
			sim.addLot('lot-B', 3, 20);
			sim.addLot('lot-C', 3, 30);

			// Sale 1: takes 3 from A (depletes A)
			sim.sell('s1', 3);
			expect(sim.findLot('lot-A')!.quantityAvailable).toBe(0);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(3);

			// Sale 2: takes 2 from B
			sim.sell('s2', 2);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(1);

			// Sale 3: takes 1 from B + 1 from C
			const plan = sim.sell('s3', 2);
			expect(plan.allocations).toHaveLength(2);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(0);
			expect(sim.findLot('lot-C')!.quantityAvailable).toBe(2);
			expect(sim.cachedStock).toBe(2);
		});

		it('cancel middle sale, then sell again uses restored stock', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 5, 10);
			sim.addLot('lot-B', 5, 20);

			sim.sell('s1', 3); // A: 5→2
			sim.sell('s2', 4); // A: 2→0, B: 5→3
			sim.sell('s3', 2); // B: 3→1

			expect(sim.cachedStock).toBe(1);

			// Cancel s2 — restores 2 to A and 2 to B
			sim.cancelSale('s2');
			expect(sim.findLot('lot-A')!.quantityAvailable).toBe(2);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(3);
			expect(sim.cachedStock).toBe(5);

			// New sale uses restored stock in FIFO order (A first)
			const plan = sim.sell('s4', 3);
			expect(plan.allocations[0].lotId).toBe('lot-A');
			expect(plan.allocations[0].quantityToConsume).toBe(2);
			expect(plan.allocations[1].lotId).toBe('lot-B');
			expect(plan.allocations[1].quantityToConsume).toBe(1);
		});

		it('cancel all sales restores all lots to initial state', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 5, 10);
			sim.addLot('lot-B', 5, 20);

			sim.sell('s1', 3);
			sim.sell('s2', 4);
			sim.sell('s3', 3);
			expect(sim.cachedStock).toBe(0);

			sim.cancelSale('s1');
			sim.cancelSale('s2');
			sim.cancelSale('s3');

			expect(sim.findLot('lot-A')!.quantityAvailable).toBe(5);
			expect(sim.findLot('lot-B')!.quantityAvailable).toBe(5);
			expect(sim.cachedStock).toBe(10);
			expect(sim.computeRealStock()).toBe(10);
		});
	});

	// ── Adjustment + sale interaction ────────────────────────────────────

	describe('adjustments with sales', () => {
		it('adjustment out reduces lot, subsequent sale uses reduced stock', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 10, 50);

			// Adjust out 3 (e.g., damage)
			sim.adjust('lot-1', -3);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(7);
			expect(sim.cachedStock).toBe(7);

			// Sale of 5 — should work, 7 available
			sim.sell('s1', 5);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(2);
			expect(sim.cachedStock).toBe(2);
		});

		it('adjustment in increases lot stock', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 5, 50);

			sim.sell('s1', 5);
			expect(sim.findLot('lot-1')!.isActive).toBe(false);

			// Adjustment in reactivates the lot
			sim.adjust('lot-1', 2);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(2);
			expect(sim.findLot('lot-1')!.isActive).toBe(true);
			expect(sim.cachedStock).toBe(2);
		});

		it('adjustment out that would go negative throws error', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 5, 50);

			expect(() => sim.adjust('lot-1', -6)).toThrow('Ajuste inválido');
		});

		it('sell after partial adjustment on depleted lot', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 3, 10);
			sim.addLot('lot-B', 3, 20);

			// Deplete lot-A via sale
			sim.sell('s1', 3);
			expect(sim.findLot('lot-A')!.isActive).toBe(false);

			// Adjust lot-A back with 1 unit (e.g., customer return)
			sim.adjust('lot-A', 1);

			// New sale should consume from lot-A first (FIFO — it's older)
			const plan = sim.sell('s2', 2);
			expect(plan.allocations[0].lotId).toBe('lot-A');
			expect(plan.allocations[0].quantityToConsume).toBe(1);
			expect(plan.allocations[1].lotId).toBe('lot-B');
			expect(plan.allocations[1].quantityToConsume).toBe(1);
		});
	});

	// ── Cost tracking ────────────────────────────────────────────────────

	describe('FIFO cost calculations', () => {
		it('weighted average cost correct for multi-lot sale', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 2, 10); // $10 each
			sim.addLot('lot-B', 5, 20); // $20 each

			// Sell 4: 2×$10 + 2×$20 = $60, avg = $15
			const plan = sim.sell('sale-1', 4);
			expect(plan.costTotal).toBe(60);
			expect(plan.costUnit).toBe(15);
			expect(plan.lotsCount).toBe(2);
		});

		it('cost reflects FIFO order, not cheapest-first', () => {
			const sim = new FifoSimulator();
			sim.addLot('expensive-old', 3, 100);
			sim.addLot('cheap-new', 10, 5);

			// Sell 2 — should cost 2×$100 = $200 (FIFO, not cheapest)
			const plan = sim.sell('sale-1', 2);
			expect(plan.costTotal).toBe(200);
			expect(plan.costUnit).toBe(100);
			expect(plan.primaryPurchasePrice).toBe(100);
		});

		it('cost accounts for lot boundaries in multi-lot sale', () => {
			const sim = new FifoSimulator();
			sim.addLot('A', 1, 5);
			sim.addLot('B', 2, 10);
			sim.addLot('C', 10, 20);

			// Sell 5: 1×$5 + 2×$10 + 2×$20 = 5 + 20 + 40 = $65, avg = $13
			const plan = sim.sell('sale-1', 5);
			expect(plan.costTotal).toBe(65);
			expect(plan.costUnit).toBe(13);
			expect(plan.lotsCount).toBe(3);
		});
	});

	// ── Movement audit trail ─────────────────────────────────────────────

	describe('movement audit trail', () => {
		it('sale creates SALE_OUT movements for each consumed lot', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 2, 10);
			sim.addLot('lot-B', 5, 20);

			sim.sell('sale-1', 4);

			const saleMovements = sim.getMovementsByRef('sale-1');
			expect(saleMovements).toHaveLength(2);
			expect(saleMovements[0].type).toBe('SALE_OUT');
			expect(saleMovements[0].lotId).toBe('lot-A');
			expect(saleMovements[0].quantityDelta).toBe(-2);
			expect(saleMovements[1].type).toBe('SALE_OUT');
			expect(saleMovements[1].lotId).toBe('lot-B');
			expect(saleMovements[1].quantityDelta).toBe(-2);
		});

		it('cancel creates CANCEL_REVERT movements mirroring SALE_OUT', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-A', 2, 10);
			sim.addLot('lot-B', 5, 20);

			sim.sell('sale-1', 4);
			sim.cancelSale('sale-1');

			const allMovements = sim.getMovementsByRef('sale-1');
			const saleOuts = allMovements.filter((m) => m.type === 'SALE_OUT');
			const reverts = allMovements.filter((m) => m.type === 'CANCEL_REVERT');

			expect(saleOuts).toHaveLength(2);
			expect(reverts).toHaveLength(2);

			// Each revert mirrors its corresponding SALE_OUT
			for (let i = 0; i < saleOuts.length; i++) {
				expect(reverts[i].lotId).toBe(saleOuts[i].lotId);
				expect(reverts[i].quantityDelta).toBe(Math.abs(saleOuts[i].quantityDelta));
			}
		});

		it('movement quantityBefore/quantityAfter chain is consistent', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 10, 50);

			sim.sell('s1', 3);
			sim.sell('s2', 2);
			sim.cancelSale('s1');

			// Filter movements for lot-1 in chronological order
			const lotMovements = sim.movements.filter((m) => m.lotId === 'lot-1');

			// quantityAfter of each movement should equal quantityBefore of the next
			for (let i = 0; i < lotMovements.length - 1; i++) {
				expect(lotMovements[i].quantityAfter).toBe(lotMovements[i + 1].quantityBefore);
			}
		});

		it('total PURCHASE_IN movements equal total stock added', () => {
			const sim = new FifoSimulator();
			sim.addLot('A', 5, 10);
			sim.addLot('B', 3, 20);
			sim.addLot('C', 7, 30);

			const purchaseIns = sim.movements.filter((m) => m.type === 'PURCHASE_IN');
			const totalIn = purchaseIns.reduce((sum, m) => sum + m.quantityDelta, 0);
			expect(totalIn).toBe(15);
		});
	});

	// ── Cached stock invariant ───────────────────────────────────────────

	describe('cached stock stays in sync with real lot stock', () => {
		it('after mixed operations, cached stock equals computed stock', () => {
			const sim = new FifoSimulator();
			sim.addLot('A', 10, 10);
			sim.addLot('B', 10, 20);

			sim.sell('s1', 5);
			sim.sell('s2', 8);
			sim.adjust('B', -2);
			sim.cancelSale('s1');

			// Cached stock should always match real stock
			expect(sim.cachedStock).toBe(sim.computeRealStock());
		});

		it('stress: many operations maintain cached/real sync', () => {
			const sim = new FifoSimulator();
			sim.addLot('A', 20, 10);
			sim.addLot('B', 20, 20);
			sim.addLot('C', 20, 30);

			sim.sell('s1', 5);
			sim.sell('s2', 10);
			sim.sell('s3', 3);
			sim.adjust('C', -2);
			sim.cancelSale('s2');
			sim.sell('s4', 8);
			sim.adjust('A', 1);
			sim.cancelSale('s3');

			expect(sim.cachedStock).toBe(sim.computeRealStock());
		});
	});

	// ── Error conditions ─────────────────────────────────────────────────

	describe('error conditions', () => {
		it('selling more than available stock throws', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 5, 50);

			expect(() => sim.sell('sale-1', 6)).toThrow('Stock en lotes insuficiente');
		});

		it('selling with no lots throws', () => {
			const sim = new FifoSimulator();
			expect(() => sim.sell('sale-1', 1)).toThrow('Stock en lotes insuficiente');
		});

		it('selling after full depletion throws', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 3, 50);
			sim.sell('s1', 3);

			expect(() => sim.sell('s2', 1)).toThrow('Stock en lotes insuficiente');
		});

		it('selling after depletion + cancel works', () => {
			const sim = new FifoSimulator();
			sim.addLot('lot-1', 3, 50);
			sim.sell('s1', 3);
			sim.cancelSale('s1');

			// Should work now — stock is restored
			const plan = sim.sell('s2', 2);
			expect(plan.allocations).toHaveLength(1);
			expect(sim.findLot('lot-1')!.quantityAvailable).toBe(1);
		});
	});
});
