<script lang="ts">
	import { Modal, Button, Spinner, type ButtonProps } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		message?: string;
		body?: Snippet; // Rich content (e.g. bullet list of missing fields)
		confirmLabel?: string;
		cancelLabel?: string;
		confirmColor?: ButtonProps['color'];
		loading?: boolean;
		icon?: Snippet;
		onConfirm: () => void;
		onCancel?: () => void; // When provided, caller controls closing. Otherwise auto-closes.
		shouldConfirm?: () => boolean | Promise<boolean>; // Determine if confirmation should be shown
		permanent?: boolean;
	}

	let {
		open = $bindable(),
		title,
		message,
		body,
		confirmLabel = 'Confirmar',
		cancelLabel = 'Cancelar',
		confirmColor = 'blue',
		loading = false,
		icon,
		onConfirm,
		onCancel,
		shouldConfirm,
		permanent = false
	}: Props = $props();

	let isChecking = $state(false);

	function handleCancel() {
		if (onCancel) {
			onCancel(); // Caller controls closing via open binding
		} else {
			open = false; // Default: auto-close
		}
	}

	async function handleConfirm() {
		if (shouldConfirm) {
			isChecking = true;
			try {
				const shouldProceed = await shouldConfirm();
				if (shouldProceed) {
					onConfirm();
				}
			} finally {
				isChecking = false;
			}
		} else {
			onConfirm();
		}
	}
</script>

<Modal bind:open size="sm" {title} {permanent}>
	<div class="flex items-start gap-3">
		{#if icon}
			{@render icon()}
		{/if}
		<div>
			{#if message}
				<p class="text-gray-700">{message}</p>
			{/if}
			{#if body}
				{@render body()}
			{/if}
		</div>
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={handleCancel} disabled={loading || isChecking}
			>{cancelLabel}</Button
		>
		<Button color={confirmColor} onclick={handleConfirm} disabled={loading || isChecking}>
			{#if loading || isChecking}<Spinner size="4" class="mr-2" />{/if}
			{confirmLabel}
		</Button>
	</div>
</Modal>
