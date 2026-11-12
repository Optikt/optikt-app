<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { cancelSessionCmd } from '$lib/remote/inventoryCount.remote';
	import type { InventoryCountSessionDetail } from '$lib/server/db/queries/inventoryCount/types';
	import { getErrorMessage } from '$lib/utils';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	interface Props {
		open: boolean;
		sessionId: number;
		/** Se emite con el detalle cuando la sesión se canceló con éxito. */
		onCancelled: (detail: InventoryCountSessionDetail) => void;
	}

	let { open = $bindable(false), sessionId, onCancelled }: Props = $props();

	let reason = $state('');
	let submitting = $state(false);

	async function confirmCancel(): Promise<void> {
		if (reason.trim().length < 5) {
			toast.error('El motivo necesita al menos 5 caracteres');
			return;
		}
		if (submitting) return;
		submitting = true;
		try {
			const response = await cancelSessionCmd({ id: sessionId, reason: reason.trim() });
			if (!response.success) {
				toast.error(response.error);
				return;
			}
			open = false;
			reason = '';
			toast.success('Sesión cancelada');
			onCancelled(response.data);
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo cancelar la sesión'));
		} finally {
			submitting = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	title="Cancelar conteo"
	confirmLabel="Confirmar cancelación"
	confirmColor="red"
	onConfirm={() => void confirmCancel()}
>
	{#snippet body()}
		<p class="text-sm text-on-surface-variant">
			La sesión queda en solo lectura y no se aplica ningún ajuste.
		</p>
		<label class="mt-3 block space-y-1">
			<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
				Motivo (mín. 5 caracteres)
			</span>
			<textarea
				bind:value={reason}
				rows="3"
				class="w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm"
				placeholder="Indica por qué se cancela el conteo"></textarea>
		</label>
	{/snippet}
</ConfirmModal>
