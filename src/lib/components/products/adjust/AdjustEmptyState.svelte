<script lang="ts">
	import { Boxes } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	interface Props {
		productId: string;
	}

	let { productId }: Props = $props();
</script>

<section class="glass-card bg-surface-container-lowest px-8 py-14 text-center">
	<div
		class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container text-brand-navy"
	>
		<Boxes class="h-6 w-6" />
	</div>
	<h2 class="font-heading mt-5 text-2xl font-bold tracking-[-0.02em] text-brand-navy">
		No hay lotes activos para ajustar
	</h2>
	<p class="mx-auto mt-2 max-w-xl text-sm text-on-surface-variant">
		Este flujo solo funciona sobre stock existente. Si necesitas ingresar unidades nuevas, usa una
		compra o reabastece primero el producto.
	</p>
	<div class="mt-8 flex justify-center">
		<a
			href={resolve(`/products/${productId}`)}
			class="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
		>
			Volver al producto
		</a>
	</div>
</section>
