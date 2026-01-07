<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';

	type ButtonColor = 'red' | 'yellow' | 'green' | 'blue' | 'light';

	interface Props {
		open: boolean;
		title: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		confirmColor?: ButtonColor;
		loading?: boolean;
		icon?: Snippet;
		onConfirm: () => void;
		onCancel?: () => void; // Optional extra callback, modal closes automatically
	}

	let {
		open = $bindable(),
		title,
		message,
		confirmLabel = 'Confirmar',
		cancelLabel = 'Cancelar',
		confirmColor = 'blue',
		loading = false,
		icon,
		onConfirm,
		onCancel
	}: Props = $props();

	function handleCancel() {
		onCancel?.(); // Run extra callback if provided
		open = false; // Always close
	}

	function handleConfirm() {
		onConfirm();
	}
</script>

<Modal bind:open size="sm" {title}>
	<div class="flex items-start gap-3">
		{#if icon}
			{@render icon()}
		{/if}
		<div>
			{#if message}
				<p class="text-gray-700">{message}</p>
			{/if}
		</div>
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={handleCancel} disabled={loading}>{cancelLabel}</Button>
		<Button color={confirmColor} onclick={handleConfirm} disabled={loading}>
			{#if loading}<Spinner size="4" class="mr-2" />{/if}
			{confirmLabel}
		</Button>
	</div>
</Modal>
