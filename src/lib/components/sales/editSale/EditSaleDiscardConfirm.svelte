<script lang="ts">
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import ReorganizeGroupsConfirm from '../groups/ReorganizeGroupsConfirm.svelte';
	import type { EditPersons } from '../groups/editPersons.svelte';

	interface Props {
		open: boolean;
		mode: 'sale' | 'quote';
		onConfirm: () => void;
		onCancel: () => void;
		persons?: EditPersons;
		saving?: boolean;
		onConfirmReorganize?: () => void;
	}

	let {
		open = $bindable(),
		mode,
		onConfirm,
		onCancel,
		persons,
		saving = false,
		onConfirmReorganize
	}: Props = $props();
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

{#if persons && onConfirmReorganize}
	<ReorganizeGroupsConfirm
		bind:open={persons.confirmReorganize}
		kind={mode}
		docLabel={persons.docLabel}
		previousGroups={persons.seedGroups}
		nextGroups={persons.submitted}
		loading={saving}
		onConfirm={() => {
			persons.confirmReorganize = false;
			onConfirmReorganize();
		}}
		onCancel={() => (persons.confirmReorganize = false)}
	/>
{/if}
