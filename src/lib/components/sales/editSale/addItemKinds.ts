import { Eye, Package, Sparkles } from '@lucide/svelte';

export const ADD_ITEM_KINDS = [
	{
		kind: 'lens',
		label: 'Cristal',
		actionLabel: 'Agregar cristal',
		hint: 'Receta y tratamientos',
		icon: Eye,
		tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300'
	},
	{
		kind: 'product',
		label: 'Producto',
		actionLabel: 'Agregar producto',
		hint: 'Montura o accesorio',
		icon: Package,
		tone: 'bg-brand-navy/10 text-brand-navy dark:bg-slate-700 dark:text-slate-200'
	},
	{
		kind: 'free',
		label: 'Ítem libre',
		actionLabel: 'Agregar ítem libre',
		hint: 'Servicio o fórmula',
		icon: Sparkles,
		tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
	}
] as const;

export type AddItemKind = (typeof ADD_ITEM_KINDS)[number]['kind'];
