/**
 * Pure FIFO lot allocation logic — no DB dependencies.
 */

export interface FifoLotInput {
	id: string;
	quantityAvailable: number;
	unitPurchasePrice: number;
}

export interface FifoAllocation {
	lotId: string;
	quantityToConsume: number;
	unitPurchasePrice: number;
	quantityBeforeConsume: number;
	quantityAfterConsume: number;
}

export interface FifoPlan {
	allocations: FifoAllocation[];
	primaryLotId: string;
	primaryPurchasePrice: number;
	/** Total cost across all lots: SUM(consumed_qty × lot.unitPurchasePrice) */
	costTotal: number;
	/** Weighted average unit cost: costTotal / quantity */
	costUnit: number;
	/** Number of distinct lots consumed */
	lotsCount: number;
}

/**
 * Plan FIFO consumption across lots for a given quantity.
 * Lots MUST be pre-sorted in FIFO order (oldest first).
 *
 * @throws Error if lots don't cover the requested quantity
 * @returns Allocation plan with lot assignments and primary lot info
 */
export function planFifoConsumption(lots: FifoLotInput[], quantity: number): FifoPlan {
	if (quantity <= 0) {
		throw new Error('La cantidad debe ser mayor a 0');
	}

	const totalAvailable = lots.reduce((sum, lot) => sum + lot.quantityAvailable, 0);
	if (totalAvailable < quantity) {
		throw new Error(
			`Stock en lotes insuficiente. Disponible: ${totalAvailable}, solicitado: ${quantity}`
		);
	}

	const allocations: FifoAllocation[] = [];
	let remaining = quantity;

	for (const lot of lots) {
		if (remaining <= 0) break;
		if (lot.quantityAvailable <= 0) continue;

		const toConsume = Math.min(lot.quantityAvailable, remaining);
		allocations.push({
			lotId: lot.id,
			quantityToConsume: toConsume,
			unitPurchasePrice: lot.unitPurchasePrice,
			quantityBeforeConsume: lot.quantityAvailable,
			quantityAfterConsume: lot.quantityAvailable - toConsume
		});
		remaining -= toConsume;
	}

	const primary = allocations[0];
	const costTotal = allocations.reduce(
		(sum, a) => sum + a.quantityToConsume * a.unitPurchasePrice,
		0
	);
	return {
		allocations,
		primaryLotId: primary.lotId,
		primaryPurchasePrice: primary.unitPurchasePrice,
		costTotal,
		costUnit: costTotal / quantity,
		lotsCount: allocations.length
	};
}
