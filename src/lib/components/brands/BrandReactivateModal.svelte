<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { reactivateBrand } from '$lib/remote/brands.remote';
	import { getErrorMessage } from '$lib/utils';

	interface BrandCandidate {
		id: string;
		name: string;
		country?: string | null;
		website?: string | null;
	}

	interface Props {
		open: boolean;
		candidate: BrandCandidate | null;
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
			await reactivateBrand({ deletedBrandId: candidate.id });
			toast.success('Marca reactivada exitosamente');
			open = false;
			onSuccess?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error reactivando marca'));
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Reactivar Marca Eliminada</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
				<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
				<div>
					<p class="font-medium text-yellow-800">Marca encontrada</p>
					<p class="mt-1 text-sm text-yellow-700">
						¿Desea reactivar esta marca eliminada? Se restaurará con los datos originales.
					</p>
				</div>
			</div>

			{#if candidate}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h4 class="mb-2 text-sm font-medium text-gray-700">Datos de la marca eliminada:</h4>
					<dl class="space-y-1 text-sm">
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Nombre:</dt>
							<dd class="text-gray-900">{candidate.name}</dd>
						</div>
						{#if candidate.country}
							<div class="flex gap-2">
								<dt class="font-medium text-gray-600">País:</dt>
								<dd class="text-gray-900">{candidate.country}</dd>
							</div>
						{/if}
						{#if candidate.website}
							<div class="flex gap-2">
								<dt class="font-medium text-gray-600">Sitio Web:</dt>
								<dd class="text-gray-900">{candidate.website}</dd>
							</div>
						{/if}
					</dl>
				</div>
			{/if}
		</div>

		<Dialog.Footer class="flex justify-end gap-2">
			<Button variant="outline" onclick={handleCancel} disabled={loading}>Cancelar</Button>
			<Button color="yellow" onclick={handleConfirm} disabled={loading}>
				{#if loading}<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
						><circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/><path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/></svg
					>{/if}
				Reactivar Marca
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
