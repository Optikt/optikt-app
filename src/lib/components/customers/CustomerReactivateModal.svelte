<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { reactivateCustomer } from '$lib/remote/customers.remote';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		open: boolean;
		candidate: {
			id: string;
			firstName: string;
			lastName: string;
			idNumber?: string | null;
			primaryPhone?: string | null;
			email?: string | null;
			address?: string | null;
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
			await reactivateCustomer({ id: candidate.id });
			toast.success('Cliente reactivado exitosamente');
			open = false;
			onSuccess?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error reactivando cliente'));
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:open size="md" title="Cliente Eliminado Encontrado">
	<div class="space-y-4">
		<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
			<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
			<div>
				<p class="font-medium text-yellow-800">Cliente encontrado</p>
				<p class="mt-1 text-sm text-yellow-700">
					¿Desea reactivar este cliente eliminado? Se restaurará con los datos originales.
				</p>
			</div>
		</div>

		{#if candidate}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h4 class="mb-2 text-sm font-medium text-gray-700">Datos del cliente eliminado:</h4>
				<dl class="space-y-1 text-sm">
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Nombre:</dt>
						<dd class="text-gray-900">
							{candidate.firstName}
							{candidate.lastName}
						</dd>
					</div>
					{#if candidate.idNumber}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Cédula:</dt>
							<dd class="text-gray-900">{candidate.idNumber}</dd>
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
					{#if candidate.address}
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Dirección:</dt>
							<dd class="text-gray-900">{candidate.address}</dd>
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
			Reactivar Cliente
		</Button>
	</div>
</Modal>
