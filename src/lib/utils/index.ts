// Utility functions barrel export
export * from './errors';
export * from './form';
export * from './rif';
export * from './generateUUID';
export * from './format';
export * from './opticalRange';
export * from './csv';
export * from './selectValue';
export * from './urlState';
import { type ClassValue, clsx } from 'clsx';
import type { SvelteHTMLElements } from 'svelte/elements';

export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}

export type WithElementRef<T> = T & { ref?: HTMLElement | null };
export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'>;
