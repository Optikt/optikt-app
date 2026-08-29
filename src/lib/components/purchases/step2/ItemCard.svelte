<script lang="ts">
	import { Check, Trash2, Glasses, Package, AlertTriangle } from '@lucide/svelte';
	import { ConfirmModal } from '$lib/components/ui';
	import type { PurchaseOrderDraftItem } from '../purchaseOrderDraft';
	import { PurchaseOrderItemType } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';

	interface Props {
		item: PurchaseOrderDraftItem;
		productName: string;
		sku: string;
		currencySymbol: string;
		saleSymbol: string;
		onremove?: () => void;
	}

	let {
		item = $bindable(),
		productName,
		sku,
		currencySymbol,
		saleSymbol,
		onremove
	}: Props = $props();

	let showDeleteConfirm = $state(false);
	const initialValues = {
		quantity: item.quantity,
		unitPurchasePrice: item.unitPurchasePrice,
		unitSalePrice: item.unitSalePrice
	};

	const lineTotal = $derived(Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0));
	const hasWarning = $derived(
		Number(item.unitPurchasePrice || 0) === 0 || Number(item.unitSalePrice || 0) === 0
	);
	const hasChanged = $derived(
		initialValues.quantity !== item.quantity ||
			initialValues.unitPurchasePrice !== item.unitPurchasePrice ||
			initialValues.unitSalePrice !== item.unitSalePrice
	);

	function toggleReviewed() {
		item.isReviewed = !item.isReviewed;
	}

	function handleDeleteClick() {
		if (item.isReviewed || hasChanged) {
			showDeleteConfirm = true;
		} else {
			onremove?.();
		}
	}

	function confirmDelete() {
		showDeleteConfirm = false;
		onremove?.();
	}
</script>

<article
	class="rounded-xl border bg-surface-container-lowest p-4 transition-all duration-150"
	style="border-left-width: {item.isReviewed || (hasWarning && !item.isZeroPriceIntentional)
		? '3px'
		: '1px'};
		border-left-color: {item.isReviewed
		? 'var(--color-brand-blue)'
		: hasWarning && !item.isZeroPriceIntentional
			? 'var(--color-warning)'
			: 'var(--color-outline-variant)'};
		background: {item.isReviewed
		? 'rgba(65,158,189,0.06)'
		: hasWarning && !item.isZeroPriceIntentional
			? 'rgba(247,144,9,0.06)'
			: 'var(--color-surface-container-lowest)'};"
	aria-label="Artículo: {productName}"
>
	<div class="flex justify-between gap-3">
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant"
			>
				{#if item.itemType === PurchaseOrderItemType.LENS}
					<Glasses class="h-4 w-4" />
				{:else}
					<Package class="h-4 w-4" />
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium text-on-surface" title="{sku} - {productName}">
					{sku} - {productName}
				</p>
				<p
					class="mt-0.5 text-[10px] font-semibold tracking-wide uppercase {item.appliesIva
						? 'text-brand-blue'
						: 'text-on-surface-variant'}"
				>
					{item.appliesIva ? `IVA ${item.ivaRate}%` : 'Compra exenta'}
				</p>
			</div>
		</div>
		<div class="flex gap-1">
			<button
				type="button"
				onclick={toggleReviewed}
				class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {item.isReviewed
					? 'border-brand-blue bg-brand-blue text-white'
					: 'border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-brand-blue hover:text-brand-blue'}"
				aria-label={item.isReviewed ? 'Desmarcar como revisado' : 'Marcar como revisado'}
				aria-pressed={item.isReviewed}
			>
				<Check class="h-4 w-4" />
			</button>
			<button
				type="button"
				onclick={handleDeleteClick}
				class="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-error hover:text-error"
				aria-label="Eliminar artículo"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	</div>

	<div class="mt-3 space-y-2">
		<div class="flex items-center justify-between gap-3">
			<span class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
				>Cantidad</span
			>
			<div class="max-w-[120px] flex-1">
				<label for="cant-m-{item.id}" class="sr-only">Cantidad</label>
				<input
					id="cant-m-{item.id}"
					type="number"
					min="1"
					step="1"
					disabled={item.isReviewed}
					bind:value={item.quantity}
					class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-1.5 text-right text-sm tabular-nums transition-colors focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>
		</div>
		<div class="flex items-center justify-between gap-3">
			<span class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
				>Costo UND.</span
			>
			<div class="relative max-w-[120px] flex-1">
				<label for="costo-m-{item.id}" class="sr-only">Costo unitario</label>
				<input
					id="costo-m-{item.id}"
					type="number"
					min="0"
					step="0.01"
					disabled={item.isReviewed}
					bind:value={item.unitPurchasePrice}
					class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-1.5 {currencySymbol.length >
					2
						? 'pr-10'
						: 'pr-6'} text-right text-sm tabular-nums transition-colors focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-on-surface-variant"
					>{currencySymbol}</span
				>
			</div>
		</div>
		<div class="flex items-center justify-between gap-3">
			<span class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
				>Venta UND.</span
			>
			<div class="relative max-w-[120px] flex-1">
				<label for="venta-m-{item.id}" class="sr-only">Precio de venta</label>
				<input
					id="venta-m-{item.id}"
					type="number"
					min="0"
					step="0.01"
					disabled={item.isReviewed}
					bind:value={item.unitSalePrice}
					class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-1.5 {currencySymbol.length >
					2
						? 'pr-10'
						: 'pr-6'} text-right text-sm tabular-nums transition-colors focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-on-surface-variant"
					>{saleSymbol}</span
				>
			</div>
		</div>
		<div class="flex items-center justify-between gap-3 border-t border-outline-variant/20 pt-1">
			<span class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
				>Total</span
			>
			<span class="text-sm font-semibold text-brand-navy tabular-nums"
				>{formatPrice(lineTotal)}</span
			>
		</div>
	</div>

	{#if hasWarning && !item.isZeroPriceIntentional}
		<div
			class="mt-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning"
			role="alert"
		>
			<AlertTriangle class="h-4 w-4 shrink-0" />
			<span>Confirma que es cortesía o extra</span>
		</div>
	{/if}
</article>

{#if showDeleteConfirm}
	<ConfirmModal
		bind:open={showDeleteConfirm}
		title="¿Eliminar artículo?"
		message={item.isReviewed
			? 'Este artículo está marcado como revisado. ¿Confirmas que deseas eliminarlo?'
			: 'Los valores han sido modificados. ¿Confirmas que deseas eliminar este artículo?'}
		confirmLabel="Eliminar"
		cancelLabel="Cancelar"
		confirmColor="red"
		onConfirm={confirmDelete}
	/>
{/if}
