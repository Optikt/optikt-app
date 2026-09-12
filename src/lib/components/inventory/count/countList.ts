import { Layers3, PackageSearch, ScanSearch } from '@lucide/svelte';
import type { InventoryCountScopeType } from '$lib/schemas/inventoryCount';
import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';

export interface CountScopeOption {
	value: InventoryCountScopeType;
	label: string;
	description: string;
	icon: typeof Layers3;
}

export const COUNT_SCOPE_OPTIONS: CountScopeOption[] = [
	{
		value: 'ALL',
		label: 'Todo el inventario',
		description: 'Audita productos y lentes STOCK en una sola sesión.',
		icon: Layers3
	},
	{
		value: 'PRODUCT_CATEGORY',
		label: 'Solo productos',
		description: 'Cuenta todos los productos o enfócate en una categoría concreta.',
		icon: PackageSearch
	},
	{
		value: 'LENS',
		label: 'Solo lentes STOCK',
		description: 'Revisa exclusivamente lentes con inventario físico.',
		icon: ScanSearch
	}
];

export function isWithinLastDays(timestamp: string | null | undefined, days: number): boolean {
	if (!timestamp) {
		return false;
	}

	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return false;
	}

	const daysWindow = days * 24 * 60 * 60 * 1000;
	return Date.now() - date.getTime() <= daysWindow;
}

export function getCoveragePercent(session: InventoryCountSessionSummary): number {
	if (session.totalLines === 0) {
		return 0;
	}

	return Math.round((session.countedLines / session.totalLines) * 100);
}

export function getScopeLabel(scopeType: string): string {
	return COUNT_SCOPE_OPTIONS.find((option) => option.value === scopeType)?.label ?? scopeType;
}

export function mergeCreatedSession(
	sessions: InventoryCountSessionSummary[],
	created: InventoryCountSessionSummary
): InventoryCountSessionSummary[] {
	return [created, ...sessions.filter((session) => session.id !== created.id)];
}
