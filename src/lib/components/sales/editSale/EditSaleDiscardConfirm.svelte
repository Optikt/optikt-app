<script lang="ts">
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	interface Props {
		open: boolean;
		mode: 'sale' | 'quote';
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { open = $bindable(), mode, onConfirm, onCancel }: Props = $props();
</script>

<ConfirmModal
	bind:open
	title="Descartar cambios"
	message={mode === 'quote'
		? 'Tienes cambios sin guardar en este presupuesto. Si cierras ahora se perderán.'
		: 'Tienes cambios sin guardar en esta venta. Si cierras ahora se perderán.'}
	confirmLabel="Descartar y cerrar"
	cancelLabel="Seguir editando"
	confirmColor="red"
	{onConfirm}
	{onCancel}
/>
