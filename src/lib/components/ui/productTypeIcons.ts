/**
 * Product type → Lucide icon mapping.
 * Shared across ItemSelect, SaleStep3Summary, CommandSearch.
 */
import {
	Glasses,
	Sun,
	Eye,
	Package,
	Microscope
} from '@lucide/svelte';
import { ProductType } from '$lib/shared/enums/productTypes';
import type { Component } from 'svelte';

const PRODUCT_TYPE_ICONS: Record<string, Component> = {
	[ProductType.FRAME]: Glasses,
	[ProductType.SUNGLASSES]: Sun,
	[ProductType.CONTACT_LENS]: Eye,
	[ProductType.ACCESSORY]: Package
};

export function getProductTypeIcon(type: string): Component {
	return PRODUCT_TYPE_ICONS[type] ?? Microscope;
}
