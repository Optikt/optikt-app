<script lang="ts">
	import { ArrowLeft, Boxes } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	interface Props {
		productId: string;
		productName: string;
		productSku: string;
		realStock: number;
		activeLotCount: number;
	}

	let { productId, productName, productSku, realStock, activeLotCount }: Props = $props();
</script>

<section class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
	<div class="space-y-3">
		<a
			href={resolve(`/products/${productId}`)}
			class="inline-flex items-center gap-2 text-[0.72rem] font-bold tracking-[0.18em] text-brand-blue uppercase transition-colors hover:text-brand-navy"
		>
			<ArrowLeft class="h-4 w-4" />
			Detalle producto
		</a>

		<div class="space-y-2">
			<h1 class="font-heading text-4xl font-extrabold tracking-[-0.04em] text-brand-navy">
				Ajuste de Inventario
			</h1>
			<p class="max-w-2xl text-sm leading-7 text-on-surface-variant">
				Modifica niveles de stock con precision. Cada accion conserva lote, costo historico y motivo
				operativo.
			</p>
		</div>
	</div>

	<div class="glass-card bg-surface-container-lowest px-5 py-4 lg:min-w-[21rem]">
		<div class="flex items-center gap-4">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-brand-navy"
			>
				<Boxes class="h-5 w-5" />
			</div>
			<div class="min-w-0">
				<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">
					Producto SKU: {productSku}
				</p>
				<p class="truncate text-lg font-semibold text-brand-navy">{productName}</p>
				<p class="mt-1 text-sm text-on-surface-variant">
					{realStock} uds disponibles en {activeLotCount} lotes activos
				</p>
			</div>
		</div>
	</div>
</section>
