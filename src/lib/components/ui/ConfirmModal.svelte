<script lang="ts">
	import { Modal, Button, Spinner, type ButtonProps } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		message?: string;
		body?: Snippet; // Rich content (e.g. bullet list of missing fields)
		confirmLabel?: string;
		secondaryLabel?: string;
		cancelLabel?: string;
		confirmColor?: ButtonProps['color'];
		secondaryColor?: ButtonProps['color'];
		loading?: boolean;
		secondaryLoading?: boolean;
		icon?: Snippet;
		onConfirm: () => void;
		onSecondary?: () => void;
		onCancel?: () => void; // When provided, caller controls closing. Otherwise auto-closes.
		shouldConfirm?: () => boolean | Promise<boolean>; // Determine if confirmation should be shown
		permanent?: boolean;
		confirmDisabled?: boolean;
	}

	let {
		open = $bindable(),
		title,
		size = 'sm',
		message,
		body,
		confirmLabel = 'Confirmar',
		secondaryLabel,
		cancelLabel = 'Cancelar',
		confirmColor = 'blue',
		secondaryColor = 'alternative',
		loading = false,
		secondaryLoading = false,
		icon,
		onConfirm,
		onSecondary,
		onCancel,
		shouldConfirm,
		permanent = false,
		confirmDisabled = false
	}: Props = $props();

	let isChecking = $state(false);
	const hasSecondaryAction = $derived(!!(onSecondary && secondaryLabel));
	const footerClass = $derived(
		['mt-6', 'flex', 'gap-2', hasSecondaryAction ? 'justify-between' : 'justify-end'].join(' ')
	);
	const isBusy = $derived(loading || secondaryLoading || isChecking);

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

<Modal bind:open {size} {title} {permanent}>
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

	<div class={footerClass}>
		{#if hasSecondaryAction}
			<Button color={secondaryColor} onclick={() => onSecondary?.()} disabled={isBusy}>
				{#if secondaryLoading}<Spinner size="4" class="mr-2" />{/if}
				{secondaryLabel}
			</Button>
		{/if}
		<div class="flex justify-end gap-2">
			<Button color="light" onclick={handleCancel} disabled={isBusy}>{cancelLabel}</Button>
			<Button color={confirmColor} onclick={handleConfirm} disabled={isBusy || confirmDisabled}>
				{#if loading || isChecking}<Spinner size="4" class="mr-2" />{/if}
				{confirmLabel}
			</Button>
		</div>
	</div>
</Modal>
