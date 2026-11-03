import { Eye, Glasses, Tag } from '@lucide/svelte';

export const ADD_ITEM_KINDS = [
	{
		kind: 'lens',
		label: 'Cristal',
		hint: 'Receta y tratamientos',
		icon: Eye
	},
	{
		kind: 'product',
		label: 'Producto',
		hint: 'Montura o accesorio del inventario',
		icon: Glasses
	},
	{
		kind: 'free',
		label: 'Ítem libre',
		hint: 'Servicio o fórmula, sin inventario',
		icon: Tag
	}
] as const;

export type AddItemKind = (typeof ADD_ITEM_KINDS)[number]['kind'];
