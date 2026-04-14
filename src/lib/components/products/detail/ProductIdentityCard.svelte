<script lang="ts">
	import { Info, Package } from '@lucide/svelte';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { AppBadge } from '$lib/components/ui';
	import { formatDate } from '$lib/utils';
	import { getProductTypeLabel } from '$lib/shared/enums';
	import type { BadgeVariant } from '$lib/shared/badge-variants';
	import { PRODUCT_GENDER_LABELS, ProductGender } from '$lib/utils/sku';

	interface Props {
		product: ProductWithRelations;
		realStock: number;
		activeLotsCount: number;
		stockHealth: { label: string; variant: BadgeVariant };
	}

	let { product, realStock, activeLotsCount, stockHealth }: Props = $props();

	const genderLabel = $derived(
		PRODUCT_GENDER_LABELS[(product.gender as ProductGender) ?? ProductGender.NO_APLICA] ??
			'No aplica'
	);
	const materialLabel = $derived(
		product.material
			? [product.material.name, product.material.code].filter(Boolean).join(' · ')
			: '—'
	);
	const stockUnitsLabel = $derived(realStock === 1 ? 'unidad total' : 'unidades totales');
	const lotsLabel = $derived(
		`${activeLotsCount} lote${activeLotsCount === 1 ? '' : 's'} activo${activeLotsCount === 1 ? '' : 's'}`
	);
</script>

<section class="glass-card bg-surface-container-lowest p-8">
	<div class="flex items-center justify-between gap-4">
		<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
			Identidad del Producto
		</h2>
		<div class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-outline">
			<Info class="h-4 w-4" />
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-3">
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Marca</p>
			<p class="text-lg font-semibold text-brand-navy">{product.brand?.name ?? '—'}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Proveedor</p>
			<p class="text-lg font-semibold text-brand-navy">{product.supplier?.name ?? '—'}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Material</p>
			<p class="text-lg font-semibold text-brand-navy">{materialLabel}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Color</p>
			<p class="text-lg font-semibold text-brand-navy">{product.color || '—'}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Genero</p>
			<p class="text-lg font-semibold text-brand-navy">{genderLabel}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Tamano</p>
			<p class="text-lg font-semibold text-brand-navy">{product.size || '—'}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Categoria</p>
			<p class="text-lg font-semibold text-brand-navy">{getProductTypeLabel(product.type)}</p>
		</div>
	</div>

	{#if product.description}
		<div class="mt-8 rounded-xl bg-surface-container-low p-5">
			<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Descripcion</p>
			<p class="mt-2 text-sm leading-6 text-on-surface-variant">{product.description}</p>
		</div>
	{/if}

	<div class="mt-8 rounded-xl bg-surface-container-low p-6">
		<div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-info-container text-on-info-container">
					<Package class="h-5 w-5" />
				</div>
				<div>
					<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">
						Estado de stock
					</p>
					<div class="mt-1 flex items-end gap-2">
						<p class="font-heading text-3xl font-bold tracking-[-0.03em] text-brand-navy">
							{realStock}
						</p>
						<p class="text-sm text-on-surface-variant">{stockUnitsLabel}</p>
					</div>
					<p class="mt-1 text-xs text-outline">{lotsLabel}</p>
				</div>
			</div>

			<div class="lg:text-right">
				<p class="text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">
					Minimo requerido
				</p>
				<div class="mt-1 flex items-center gap-2 lg:justify-end">
					<p class="font-heading text-2xl font-bold tracking-[-0.03em] text-brand-navy">
						{product.minStock ?? '—'}
					</p>
					<AppBadge variant={stockHealth.variant}>{stockHealth.label}</AppBadge>
				</div>
			</div>
		</div>
	</div>

	<div class="mt-6 grid gap-3 md:grid-cols-3">
		<div class="rounded-xl bg-surface-container-low p-4">
			<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">SKU</p>
			<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">{product.sku}</p>
		</div>
		<div class="rounded-xl bg-surface-container-low p-4">
			<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">Creado</p>
			<p class="mt-2 text-sm font-semibold text-brand-navy">{formatDate(product.createdAt)}</p>
		</div>
		<div class="rounded-xl bg-surface-container-low p-4">
			<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">Actualizado</p>
			<p class="mt-2 text-sm font-semibold text-brand-navy">{formatDate(product.updatedAt)}</p>
		</div>
	</div>
</section>