import { Eye, FlaskConical, Glasses, Tag } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { DocumentItemTone } from './itemView';

/** Icon tile styles per item kind, shared by rows and forms. */
export const ITEM_TONES: Record<
	DocumentItemTone,
	{ icon: Component; iconClass: string; badgeClass: string }
> = {
	crystal: {
		icon: Eye,
		iconClass:
			'bg-brand-blue/15 text-brand-blue-dark dark:bg-brand-blue/25 dark:text-brand-blue-light',
		badgeClass:
			'bg-brand-blue/10 text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue-light'
	},
	product: {
		icon: Glasses,
		iconClass: 'bg-brand-gold/25 text-brand-navy dark:bg-brand-gold/20 dark:text-brand-gold-light',
		badgeClass: 'bg-brand-gold/20 text-brand-navy dark:bg-brand-gold/15 dark:text-brand-gold-light'
	},
	free: {
		icon: Tag,
		iconClass:
			'bg-surface-container-high text-on-surface-variant dark:bg-slate-700 dark:text-slate-300',
		badgeClass:
			'bg-surface-container-high text-on-surface-variant dark:bg-slate-700 dark:text-slate-300'
	},
	treatment: {
		icon: FlaskConical,
		iconClass: 'bg-brand-navy/10 text-brand-navy dark:bg-brand-blue/20 dark:text-brand-blue-light',
		badgeClass: 'bg-brand-navy/10 text-brand-navy dark:bg-brand-blue/20 dark:text-brand-blue-light'
	}
};

export const BADGE_TONES: Record<string, string> = {
	neutral:
		'bg-surface-container-high text-on-surface-variant dark:bg-slate-700 dark:text-slate-300',
	info: 'bg-brand-blue/10 text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue-light',
	warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
	success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
	danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};
