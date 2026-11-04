import { Eye, FlaskConical, Glasses, Tag } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { DocumentItemKind } from './itemView';

/**
 * Neutral icon chip per item kind. Structure is greyscale; colour is earned
 * by state (badges),never by the item type (design rule #3).
 */
export const ITEM_KIND_ICONS: Record<DocumentItemKind, { icon: Component; chipClass: string }> = {
	crystal: { icon: Eye, chipClass: 'bg-[#e6ecf4] text-brand-navy' },
	product: { icon: Glasses, chipClass: 'bg-[#e6ecf4] text-brand-navy' },
	free: { icon: Tag, chipClass: 'bg-[#e6ecf4] text-brand-navy' },
	/** Treatment children sit on the info container (they belong to a lens). */
	treatment: { icon: FlaskConical, chipClass: 'bg-info-container text-on-info-container' }
};

/** Small chips inside a parent card (danger/info tones for the actions). */
export const BADGE_TONES: Record<string, string> = {
	neutral: 'bg-surface-container-high text-on-surface-variant',
	info: 'bg-info-container text-on-info-container',
	warning: 'bg-warning-container text-on-warning-container',
	success: 'bg-success-container text-on-success-container',
	danger: 'bg-error-container text-on-error-container'
};
