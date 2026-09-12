<script lang="ts">
	import { Eye } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { copyOnLongPress } from '$lib/actions/copyOnLongPress';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { AppBadge, ProductTypeBadge } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import { stockBadgeVariant, stockCountClasses, stockLabel } from './productTableDisplay';

	type ProductViewHref = `/products/${string}`;
	type ProductEditHref = `/products/${string}/update`;

	interface Props {
		product: ProductWithRelations;
		viewHref?: ProductViewHref;
		editHref?: ProductEditHref;
		canManage: boolean;
		mobileActionsOpenFor: string | null;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onToggleActions: (event: MouseEvent, productId: string) => void;
		onCloseActions: () => void;
		onDelete: (product: ProductWithRelations) => void;
		onReactivate: (product: ProductWithRelations) => void;
		onLongPressCopied: (label: string) => void;
		onLongPressError: (error: unknown, label: string) => void;
	}

	let {
		product,
		viewHref,
		editHref,
		canManage,
		mobileActionsOpenFor,
		onView,
		onEdit,
		onToggleActions,
		onCloseActions,
		onDelete,
		onReactivate,
		onLongPressCopied,
		onLongPressError
	}: Props = $props();
</script>

<div class="space-y-2">
	<div class="flex items-start gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 class="min-w-0 text-xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-2xl">
					{product.name}
				</h3>
				<p
					class="font-mono text-lg font-semibold tabular-nums {product.currentSalePrice != null
						? 'text-brand-navy'
						: 'text-outline'}"
				>
					{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '-'}
				</p>
			</div>

			<p class="mt-2 text-[15px] text-on-surface-variant">
				{product.brand?.name ?? product.supplier?.name ?? 'Sin referencia'}
			</p>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if viewHref}
				<a
					href={resolve(viewHref)}
					class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 text-outline transition-colors hover:border-brand-blue/30 hover:bg-info-container hover:text-on-info-container"
					title="Ver producto"
					aria-label="Ver producto"
				>
					<Eye class="h-5 w-5" />
				</a>
			{:else if onView}
				<button
					type="button"
					onclick={() => onView?.(product)}
					class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 text-outline transition-colors hover:border-brand-blue/30 hover:bg-info-container hover:text-on-info-container"
					title="Ver producto"
					aria-label="Ver producto"
				>
					<Eye class="h-5 w-5" />
				</button>
			{/if}

			{#if canManage}
				<div class="relative" data-mobile-actions>
					<button
						type="button"
						onclick={(event) => onToggleActions(event, product.id)}
						class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 text-outline transition-colors hover:border-brand-blue/30 hover:bg-surface-container-high hover:text-brand-blue"
						title="Más acciones"
						aria-label="Más acciones"
						aria-expanded={mobileActionsOpenFor === product.id}
					>
						<span class="flex items-center justify-center gap-0.5" aria-hidden="true">
							<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
							<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
							<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
						</span>
					</button>

					{#if mobileActionsOpenFor === product.id}
						<div
							class="absolute top-full right-0 z-20 mt-2 min-w-36 overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container-lowest py-1 shadow-sm"
						>
							{#if !product.deletedAt}
								{#if editHref}
									<a
										href={resolve(editHref)}
										onclick={() => onCloseActions()}
										class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
									>
										Editar
									</a>
								{:else if onEdit}
									<button
										type="button"
										onclick={() => {
											onCloseActions();
											onEdit?.(product);
										}}
										class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
									>
										Editar
									</button>
								{/if}
							{/if}

							{#if product.deletedAt}
								<button
									type="button"
									onclick={() => onReactivate(product)}
									class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-success-container hover:text-on-success-container"
								>
									Reactivar
								</button>
							{:else}
								<button
									type="button"
									onclick={() => onDelete(product)}
									class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-error transition-colors hover:bg-error-container hover:text-on-error-container"
								>
									Eliminar
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div
		class="grid grid-cols-[auto_minmax(0,0.9fr)_auto_minmax(0,1.35fr)] items-baseline gap-x-2 gap-y-1 text-[11px] text-on-surface-variant"
	>
		<span class="shrink-0 font-semibold tracking-[0.14em] text-outline uppercase">Cod.</span>
		<button
			type="button"
			use:copyOnLongPress={{
				text: product.personalCode?.trim() || undefined,
				delay: 2000,
				onCopied: () => onLongPressCopied('Código interno'),
				onError: (error) => onLongPressError(error, 'Código interno')
			}}
			class="min-w-0 truncate bg-transparent text-left font-mono text-[12px] font-medium text-on-surface-variant select-none"
			title="Mantén presionado para copiar el código interno"
		>
			{product.personalCode?.trim() || '-'}
		</button>

		<span class="shrink-0 font-semibold tracking-[0.14em] text-outline uppercase">SKU</span>
		<button
			type="button"
			use:copyOnLongPress={{
				text: product.sku,
				delay: 2000,
				onCopied: () => onLongPressCopied('SKU'),
				onError: (error) => onLongPressError(error, 'SKU')
			}}
			class="min-w-0 truncate bg-transparent text-left font-mono text-[12px] font-medium text-on-surface-variant select-none"
			title="Mantén presionado para copiar el SKU"
		>
			{product.sku}
		</button>
	</div>

	<div class="flex flex-wrap items-center gap-2 pt-1">
		<ProductTypeBadge type={product.type} class="rounded-full px-4 py-1.5 text-[11px]" />

		<AppBadge variant={stockBadgeVariant(product)} class="rounded-full px-4 py-1.5 text-[11px]">
			{stockLabel(product)}
		</AppBadge>

		<span
			class="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-mono text-sm font-bold tabular-nums {stockCountClasses(
				product
			)}"
		>
			{product.stock}
		</span>

		{#if product.deletedAt}
			<AppBadge variant="neutral" class="rounded-full px-4 py-1.5 text-[11px]">Inactivo</AppBadge>
		{/if}
	</div>
</div>
