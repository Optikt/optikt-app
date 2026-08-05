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

<div
	class="@container rounded-xl border bg-surface-container-lowest p-3 transition-all duration-150"
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
	<div
		class="grid grid-cols-[minmax(160px,1fr)_70px_110px_110px_90px_72px] gap-3 items-center
			max-[500px]:grid-cols-[1fr_auto]
			max-[500px]:gap-2"
	>
		<!-- Producto -->
		<div class="flex items-center gap-2 min-w-0 max-[500px]:col-span-2">
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
					class="mt-0.5 text-[10px] font-semibold uppercase tracking-wide {item.appliesIva
						? 'text-brand-blue'
						: 'text-on-surface-variant'}"
				>
					{item.appliesIva ? `IVA ${item.ivaRate}%` : 'Compra exenta'}
				</p>
			</div>
			<!-- Acciones (aparecen dentro del área de producto en modo angosto) -->
			<div class="max-[500px]:flex hidden items-center justify-end gap-1 ml-auto">
				<button
					type="button"
					onclick={toggleReviewed}
					class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {item.isReviewed
						? 'bg-brand-blue text-white border-brand-blue'
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

		<!-- Cantidad -->
		<div class="max-[500px]:col-start-1">
			<label for="cant-{item.id}" class="sr-only">Cantidad</label>
			<input
				id="cant-{item.id}"
				type="number"
				min="1"
				step="1"
				disabled={item.isReviewed}
				bind:value={item.quantity}
				class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-1.5 text-center text-sm tabular-nums transition-colors focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
				aria-label="Cantidad"
			/>
		</div>

		<!-- Costo UND -->
		<div class="max-[500px]:col-start-1">
			<label for="costo-{item.id}" class="sr-only">Costo unitario</label>
			<div class="relative">
				<input
					id="costo-{item.id}"
					type="number"
					min="0"
					step="0.01"
					disabled={item.isReviewed}
					bind:value={item.unitPurchasePrice}
					class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-1.5 {currencySymbol.length >
					2
						? 'pr-10'
						: 'pr-6'} text-right text-sm tabular-nums transition-colors focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
					aria-label="Costo unitario"
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-on-surface-variant"
					>{currencySymbol}</span
				>
			</div>
		</div>

		<!-- Venta UND -->
		<div class="max-[500px]:col-start-2">
			<label for="venta-{item.id}" class="sr-only">Precio de venta</label>
			<div class="relative">
				<input
					id="venta-{item.id}"
					type="number"
					min="0"
					step="0.01"
					disabled={item.isReviewed}
					bind:value={item.unitSalePrice}
					class="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2 py-1.5 {currencySymbol.length >
					2
						? 'pr-10'
						: 'pr-6'} text-right text-sm tabular-nums transition-colors focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
					aria-label="Precio de venta"
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-on-surface-variant"
					>{saleSymbol}</span
				>
			</div>
		</div>

		<!-- Total -->
		<div class="flex items-center justify-end max-[500px]:col-start-2">
			<span class="text-sm font-semibold text-brand-navy tabular-nums"
				>{formatPrice(lineTotal)}</span
			>
		</div>

		<!-- Acciones (visibles en modo ancho) -->
		<div class="flex items-center justify-end gap-1 max-[500px]:hidden">
			<button
				type="button"
				onclick={toggleReviewed}
				class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {item.isReviewed
					? 'bg-brand-blue text-white border-brand-blue'
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

	<!-- Warning -->
	{#if hasWarning && !item.isZeroPriceIntentional}
		<div
			class="mt-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning"
			role="alert"
		>
			<AlertTriangle class="h-4 w-4 shrink-0" />
			<span>Confirma que es cortesía o extra</span>
		</div>
	{/if}
</div>

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
