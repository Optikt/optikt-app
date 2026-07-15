<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { reactivateMaterial } from '$lib/remote/materials.remote';
	import { getErrorMessage } from '$lib/utils';
	import type { MaterialCategory } from '$lib/shared/enums/productTypes';
	import { MATERIAL_CATEGORY_LABELS } from '$lib/shared/enums/productTypes';
	import type { Material } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		candidate: Material | null;
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
			await reactivateMaterial({ deletedMaterialId: candidate.id });
			toast.success('Material reactivado exitosamente');
			open = false;
			onSuccess?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error reactivando material'));
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Reactivar Material Eliminado</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
				<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
				<div>
					<p class="font-medium text-yellow-800">Material encontrado</p>
					<p class="mt-1 text-sm text-yellow-700">
						¿Desea reactivar este material eliminado? Se restaurará con los datos originales.
					</p>
				</div>
			</div>

			{#if candidate}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h4 class="mb-2 text-sm font-medium text-gray-700">Datos del material eliminado:</h4>
					<div class="space-y-1 text-sm">
						<div class="flex gap-2">
							<span class="font-medium text-gray-600">Nombre:</span>
							<span class="text-gray-900">{candidate.name}</span>
						</div>
						<div class="flex gap-2">
							<span class="font-medium text-gray-600">Código:</span>
							<span class="font-mono text-gray-900">{candidate.code}</span>
						</div>
						<div class="flex gap-2">
							<span class="font-medium text-gray-600">Tipo:</span>
							<span class="text-gray-900"
								>{MATERIAL_CATEGORY_LABELS[candidate.productType as MaterialCategory] ??
									candidate.productType}</span
							>
						</div>
						{#if candidate.description}
							<div class="flex gap-2">
								<span class="font-medium text-gray-600">Descripción:</span>
								<span class="text-gray-900">{candidate.description}</span>
							</div>
						{/if}
					</div>
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
				Reactivar Material
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
