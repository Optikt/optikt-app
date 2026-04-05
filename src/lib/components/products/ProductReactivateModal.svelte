<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { reactivateProduct } from '$lib/remote/products.remote';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		open: boolean;
		candidate: {
			id: string;
			sku: string;
			name: string;
			type: string;
			currentPurchasePrice?: number | null;
			currentSalePrice?: number | null;
			stock?: number | null;
		} | null;
		onSuccess?: () => void;
	}

	let { open = $bindable(), candidate, onSuccess }: Props = $props();

	let loading = $state(false);

	function handleCancel() {
		open = false;
	}

	async function handleConfirm() {
		if (!candidate) return;

		loading = true;
		try {
			await reactivateProduct({ deletedProductId: candidate.id });
			toast.success('Producto reactivado exitosamente');
			open = false;
			onSuccess?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error reactivando producto'));
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:open size="md" title="Reactivar Producto Eliminado">
	<div class="space-y-4">
		<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
			<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
			<div>
				<p class="font-medium text-yellow-800">Producto encontrado</p>
				<p class="mt-1 text-sm text-yellow-700">
					¿Desea reactivar este producto eliminado? Se restaurará con los datos originales.
				</p>
			</div>
		</div>

		{#if candidate}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h4 class="mb-2 text-sm font-medium text-gray-700">Datos del producto eliminado:</h4>
				<dl class="space-y-1 text-sm">
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">SKU:</dt>
						<dd class="font-mono text-gray-900">{candidate.sku}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Nombre:</dt>
						<dd class="text-gray-900">{candidate.name}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Tipo:</dt>
						<dd class="text-gray-900">{candidate.type}</dd>
					</div>
					{#if candidate.currentPurchasePrice != null}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Precio compra:</dt>
							<dd class="font-mono text-gray-900">${candidate.currentPurchasePrice.toFixed(2)}</dd>
						</div>
					{/if}
					{#if candidate.currentSalePrice != null}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Precio venta:</dt>
							<dd class="font-mono text-gray-900">${candidate.currentSalePrice.toFixed(2)}</dd>
						</div>
					{/if}
					{#if candidate.stock !== null}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Stock:</dt>
							<dd class="font-mono text-gray-900">{candidate.stock}</dd>
						</div>
					{/if}
				</dl>
			</div>
		{/if}
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={handleCancel} disabled={loading}>Cancelar</Button>
		<Button color="yellow" onclick={handleConfirm} disabled={loading}>
			{#if loading}<Spinner size="4" class="mr-2" />{/if}
			Reactivar Producto
		</Button>
	</div>
</Modal>
