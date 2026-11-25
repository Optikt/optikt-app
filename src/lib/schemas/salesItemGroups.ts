/**
 * Per-person grouping schemas (shared by sales and quotes).
 */
import { z } from 'zod';
import { CoercedInteger } from './common/numbers';
import {
	ITEM_GROUP_LABEL_MAX,
	MAX_ITEM_GROUPS,
	validateItemGroups,
	type GroupableItem
} from '$lib/shared/saleItemGroups';

export const ItemGroupMemberSchema = z.object({
	/** Client id of the line (`SaleItemSchema.id`) on create/update; real id on groups-only save. */
	itemId: z.uuid('Artículo inválido'),
	quantity: CoercedInteger.min(1, 'Cantidad inválida')
});

export const ItemGroupSchema = z.object({
	label: z
		.string()
		.trim()
		.max(ITEM_GROUP_LABEL_MAX, `Máximo ${ITEM_GROUP_LABEL_MAX} caracteres`)
		.nullable()
		.optional()
		.transform((v) => (v ? v : null)),
	members: z
		.array(ItemGroupMemberSchema)
		.min(1, 'Cada persona debe tener al menos un artículo')
		.refine(
			(members) => new Set(members.map((m) => m.itemId)).size === members.length,
			'Artículo repetido en la misma persona'
		)
});

export const ItemGroupsSchema = z
	.array(ItemGroupSchema)
	.max(MAX_ITEM_GROUPS, `Máximo ${MAX_ITEM_GROUPS} personas`);

export type ItemGroupInput = z.infer<typeof ItemGroupSchema>;

type GroupableInput = {
	id?: string;
	itemType: string;
	quantity: number;
	parentSaleItemId?: string;
	parentQuoteItemId?: string;
};

/** Cross-validation for documents that carry items + groups (+ primary lens). */
export function refineItemGroups(
	data: {
		items?: GroupableInput[];
		groups?: { label: string | null; members: { itemId: string; quantity: number }[] }[];
		primaryLensItemId?: string | null;
	},
	ctx: z.RefinementCtx
): void {
	if (!data.items) return;
	if (!data.groups && !data.primaryLensItemId) return;
	const seenIds = new Set<string>();
	const items: GroupableItem[] = [];
	for (const item of data.items) {
		if (!item.id) continue;
		if (seenIds.has(item.id)) {
			ctx.addIssue({
				code: 'custom',
				message: 'Artículos con identificador duplicado',
				path: ['items']
			});
			return;
		}
		seenIds.add(item.id);
		items.push({ id: item.id, itemType: item.itemType, quantity: item.quantity });
	}
	for (const message of validateItemGroups(data.groups ?? [], items, data.primaryLensItemId)) {
		const isPrimaryError = message.startsWith('La fórmula principal');
		ctx.addIssue({
			code: 'custom',
			message,
			path: [isPrimaryError ? 'primaryLensItemId' : 'groups']
		});
	}
}
