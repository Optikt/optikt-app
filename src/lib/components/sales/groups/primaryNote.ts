import { groupDisplayLabel, type ItemGroup } from '$lib/shared/saleItemGroups';
import type { GroupItemView } from './groupsState';

/** Footer text explaining what happens with the customer's prescription (sales only). */
export function primaryNote(
	items: readonly GroupItemView[],
	groups: readonly ItemGroup[],
	primaryLensId: string | null
): string {
	const lenses = items.filter((i) => i.itemType === 'LENS_PAIR');
	if (lenses.length === 0) return 'Sin cristales: no se guarda fórmula al cliente.';
	if (!primaryLensId) {
		return 'Sin fórmula principal: no se crea ni se reemplaza la fórmula del cliente.';
	}
	const index = groups.findIndex((g) => g.members.some((m) => m.itemId === primaryLensId));
	const lens = lenses.find((l) => l.id === primaryLensId);
	const who =
		index >= 0 ? groupDisplayLabel(groups[index].label, index) : (lens?.name ?? 'cristal');
	return `★ Fórmula del cliente: ${who}. Se guarda como su fórmula vigente.`;
}
