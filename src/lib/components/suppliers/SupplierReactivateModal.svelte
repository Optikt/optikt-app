<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { reactivateSupplier } from '$lib/remote/suppliers.remote';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		open: boolean;
		candidate: {
			id: string;
			name: string;
			type?: string | null;
			rif?: string | null;
			primaryPhone?: string | null;
			email?: string | null;
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
			await reactivateSupplier({ deletedSupplierId: candidate.id });
			toast.success('Proveedor reactivado exitosamente');
			open = false;
			onSuccess?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error reactivando proveedor'));
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:open size="md" title="Reactivar Proveedor Eliminado">
	<div class="space-y-4">
		<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
			<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
			<div>
				<p class="font-medium text-yellow-800">Proveedor encontrado</p>
				<p class="mt-1 text-sm text-yellow-700">
					¿Desea reactivar este proveedor eliminado? Se restaurará con los datos originales.
				</p>
			</div>
		</div>

		{#if candidate}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h4 class="mb-2 text-sm font-medium text-gray-700">Datos del proveedor eliminado:</h4>
				<dl class="space-y-1 text-sm">
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Nombre:</dt>
						<dd class="text-gray-900">{candidate.name}</dd>
					</div>
					{#if candidate.type}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Tipo:</dt>
							<dd class="text-gray-900">{candidate.type}</dd>
						</div>
					{/if}
					{#if candidate.rif}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">RIF:</dt>
							<dd class="font-mono text-gray-900">{candidate.rif}</dd>
						</div>
					{/if}
					{#if candidate.primaryPhone}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Teléfono:</dt>
							<dd class="text-gray-900">{candidate.primaryPhone}</dd>
						</div>
					{/if}
					{#if candidate.email}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Email:</dt>
							<dd class="text-gray-900">{candidate.email}</dd>
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
			Reactivar Proveedor
		</Button>
	</div>
</Modal>
