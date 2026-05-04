import { getContext, setContext } from 'svelte';

export type ActiveInventoryCountSession = {
	id: number;
};

export type InventoryCountContext = {
	activeSession: ActiveInventoryCountSession | null;
};

const INVENTORY_COUNT_CONTEXT_KEY = Symbol('inventoryCount');

export function setInventoryCountContext(context: InventoryCountContext): void {
	setContext(INVENTORY_COUNT_CONTEXT_KEY, context);
}

export function getInventoryCountContext(): InventoryCountContext {
	const context = getContext<InventoryCountContext>(INVENTORY_COUNT_CONTEXT_KEY);
	if (!context) {
		throw new Error(
			'InventoryCount context not found. Make sure setInventoryCountContext is called in a parent component.'
		);
	}

	return context;
}
