import { Eye, Glasses, Tag } from '@lucide/svelte';

export const ADD_ITEM_KINDS = [
	{
		kind: 'lens',
		label: 'Cristal',
		hint: 'Receta y tratamientos',
		icon: Eye,
		tone: 'bg-brand-blue/15 text-brand-blue-dark dark:bg-brand-blue/25 dark:text-brand-blue-light'
	},
	{
		kind: 'product',
		label: 'Producto',
		hint: 'Montura o accesorio del inventario',
		icon: Glasses,
		tone: 'bg-brand-gold/25 text-brand-navy dark:bg-brand-gold/20 dark:text-brand-gold-light'
	},
	{
		kind: 'free',
		label: 'Ítem libre',
		hint: 'Servicio o fórmula, sin inventario',
		icon: Tag,
		tone: 'bg-surface-container-high text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'
	}
] as const;

export type AddItemKind = (typeof ADD_ITEM_KINDS)[number]['kind'];
