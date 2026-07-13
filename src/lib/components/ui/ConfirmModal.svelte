<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import type { Snippet } from 'svelte';

	const sizeClass: Record<string, string> = {
		xs: 'sm:max-w-xs',
		sm: 'sm:max-w-sm',
		md: 'sm:max-w-md',
		lg: 'sm:max-w-lg',
		xl: 'sm:max-w-xl'
	};

	const colorMap: Record<string, 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'> = {
		blue: 'default',
		red: 'destructive',
		green: 'default',
		yellow: 'outline',
		alternative: 'secondary',
		light: 'outline',
		default: 'default',
		destructive: 'destructive',
		outline: 'outline',
		secondary: 'secondary',
		ghost: 'ghost',
		link: 'link'
	};

	interface Props {
		open: boolean;
		title: string;
		size?: keyof typeof sizeClass;
		message?: string;
		body?: Snippet;
		confirmLabel?: string;
		secondaryLabel?: string;
		cancelLabel?: string;
		confirmColor?: string;
		secondaryColor?: string;
		loading?: boolean;
		secondaryLoading?: boolean;
		icon?: Snippet;
		onConfirm: () => void;
		onSecondary?: () => void;
		onCancel?: () => void;
		shouldConfirm?: () => boolean | Promise<boolean>;
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

	const confirmVariant = $derived(colorMap[confirmColor] ?? 'default');
	const secondaryVariant = $derived(colorMap[secondaryColor] ?? 'secondary');

	let isChecking = $state(false);
	const hasSecondaryAction = $derived(!!(onSecondary && secondaryLabel));
	const footerClass = $derived(
		['mt-6', 'flex', 'gap-2', hasSecondaryAction ? 'justify-between' : 'justify-end'].join(' ')
	);
	const isBusy = $derived(loading || secondaryLoading || isChecking);

	function handleCancel() {
		if (onCancel) {
			onCancel();
		} else {
			open = false;
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

<Dialog.Root bind:open>
	<Dialog.Content class={sizeClass[size]} showCloseButton={!permanent}>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>

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
				<Button variant={secondaryVariant} onclick={() => onSecondary?.()} disabled={isBusy}>
					{#if secondaryLoading}
						<svg class="mr-2 inline-block h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
					{/if}
					{secondaryLabel}
				</Button>
			{/if}
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={handleCancel} disabled={isBusy}>{cancelLabel}</Button>
				<Button variant={confirmVariant} onclick={handleConfirm} disabled={isBusy || confirmDisabled}>
					{#if loading || isChecking}
						<svg class="mr-2 inline-block h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
					{/if}
					{confirmLabel}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
