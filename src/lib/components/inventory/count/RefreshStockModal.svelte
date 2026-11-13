<script lang="ts">
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import type { StockRefreshPreview } from '$lib/server/db/queries/inventoryCount/refresh';

	interface Props {
		open: boolean;
		/** Resultado del preview: qué cambiaría al refrescar. */
		preview: StockRefreshPreview | null;
		onConfirm: () => void;
	}

	let { open = $bindable(), preview, onConfirm }: Props = $props();

	const message = $derived(
		preview
			? `Se actualizará el stock de ${preview.updatedLines} línea(s) contra el stock real del sistema. ${
					preview.clearedCounts > 0
						? `${preview.clearedCounts} de ellas tienen conteo y lo perderán (habrá que recontarlas antes de avanzar). `
						: ''
				}Las ${preview.untouchedLines} restantes no cambian y conservan lo que ya escribiste.`
			: ''
	);
</script>

<ConfirmModal
	bind:open
	title="Refrescar stock del sistema"
	{message}
	confirmLabel="Refrescar"
	confirmColor="blue"
	{onConfirm}
/>
