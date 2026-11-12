<script lang="ts">
	import { resolve } from '$app/paths';
	import { Copy } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { logger } from '$lib/utils/logger';

	interface Props {
		itemName: string;
		itemCode?: string | null;
		/** 'PRODUCT' | 'LENS' (varchar de BD; otro valor = sin enlace). */
		itemType?: string | null;
		productId?: string | null;
		lensCatalogItemId?: string | null;
		/** Clases extra para el nombre (p. ej. el título grande de la ficha). */
		nameClass?: string;
	}

	let {
		itemName,
		itemCode = null,
		itemType = null,
		productId = null,
		lensCatalogItemId = null,
		nameClass = ''
	}: Props = $props();

	const href = $derived(
		itemType === 'LENS' && lensCatalogItemId
			? resolve(`/lenses/${lensCatalogItemId}`)
			: itemType === 'PRODUCT' && productId
				? resolve(`/products/${productId}`)
				: null
	);

	const copyText = $derived(itemCode ? `${itemName} (${itemCode})` : itemName);

	async function copyItem(): Promise<void> {
		try {
			await navigator.clipboard.writeText(copyText);
			toast.success('Copiado al portapapeles');
		} catch (error) {
			logger.error('No se pudo copiar el ítem', error);
			toast.error('No se pudo copiar');
		}
	}
</script>

<span class="flex min-w-0 items-center gap-1">
	{#if href}
		<a
			{href}
			target="_blank"
			class="truncate text-sm font-medium text-brand-navy hover:underline {nameClass}">{itemName}</a
		>
	{:else}
		<span class="truncate text-sm font-medium text-brand-navy {nameClass}">{itemName}</span>
	{/if}
	<button
		type="button"
		aria-label={`Copiar ${itemName}`}
		onclick={copyItem}
		class="shrink-0 rounded p-0.5 text-outline-variant transition-colors hover:bg-surface-container hover:text-brand-navy"
	>
		<Copy class="h-3.5 w-3.5" aria-hidden="true" />
	</button>
</span>
