<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { Trash2 } from '@lucide/svelte';

	interface Props {
		open: boolean;
		userName: string;
		loading?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { open = $bindable(), userName, loading = false, onConfirm, onCancel }: Props = $props();
</script>

<Modal bind:open size="xs">
	<div class="text-center">
		<Trash2 class="mx-auto mb-4 h-12 w-12 text-red-500" />
		<h3 class="mb-2 text-lg font-semibold text-gray-900">¿Eliminar usuario?</h3>
		<p class="mb-6 text-gray-500">
			Esta acción eliminará permanentemente a <strong>{userName}</strong>.
		</p>
		<div class="flex justify-center gap-3">
			<Button color="light" onclick={onCancel}>Cancelar</Button>
			<Button color="red" onclick={onConfirm} disabled={loading}>
				{#if loading}<Spinner size="4" class="mr-2" />{/if}
				Eliminar
			</Button>
		</div>
	</div>
</Modal>
