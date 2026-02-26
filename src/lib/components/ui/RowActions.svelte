<script lang="ts" generics="T extends { id: string }">
	import type { Component } from 'svelte';
	type ActionColor = 'default' | 'blue' | 'red' | 'amber' | 'green';

	interface TableAction {
		id: string;
		icon?: Component<{ class?: string }>;
		label: string;
		color?: ActionColor;
		onclick?: () => void;
		hidden?: boolean;
		disabled?: boolean;
	}
	import ActionButton from './ActionButton.svelte';

	interface Props {
		item: T;
		actions: TableAction[];
		/** Called when any action is clicked, useful for analytics/tracking */
		onAction?: (actionId: string, item: T) => void;
		/** Custom class for the container */
		class?: string;
	}

	let { item, actions, onAction, class: className = '' }: Props = $props();

	function handleClick(action: TableAction) {
		if (action.disabled || action.hidden) return;

		// Call the action's onclick if defined
		action.onclick?.();

		// Also notify parent handler
		onAction?.(action.id, item);
	}

	// Filter visible actions and maintain order
	const visibleActions = $derived(actions.filter((a) => !a.hidden));
</script>

<div class="flex justify-end gap-1 {className}">
	{#each visibleActions as action (action.id)}
		<ActionButton
			icon={action.icon as Component<{ class?: string }>}
			title={action.label}
			color={action.color as ActionColor}
			hidden={false}
			disabled={action.disabled}
			onclick={() => handleClick(action)}
		/>
	{/each}
</div>
