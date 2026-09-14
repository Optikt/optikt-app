<script lang="ts" generics="T extends string">
	import { Select } from 'bits-ui';
	import { Check, ChevronDown, X } from '@lucide/svelte';

	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		options: Option[];
		value: T[];
		labelAll?: string;
		onChange: (values: T[]) => void;
	}

	let { options, value = $bindable(), labelAll = 'Todos', onChange }: Props = $props();

	const triggerLabel = $derived.by(() => {
		if (value.length === 0) return labelAll;
		if (value.length === 1) {
			return options.find((o) => o.value === value[0])?.label ?? value[0];
		}
		return `${value.length} seleccionados`;
	});

	function clear(event: MouseEvent) {
		event.stopPropagation();
		onChange([]);
	}
</script>

<Select.Root type="multiple" bind:value onValueChange={(v) => onChange((v ?? []) as T[])}>
	<Select.Trigger
		class="inline-flex min-w-[10rem] flex-1 items-center justify-between gap-2 rounded-lg border-none bg-surface-container-high px-3 py-2.5 text-sm font-medium text-on-surface transition-colors focus:bg-surface-container-highest focus:ring-0"
		aria-label={labelAll}
	>
		<span class="truncate">{triggerLabel}</span>
		<span class="flex shrink-0 items-center gap-1">
			{#if value.length > 0}
				<button
					type="button"
					onclick={clear}
					class="rounded p-0.5 text-outline transition-colors hover:text-on-surface"
					aria-label="Limpiar selección"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			{/if}
			<ChevronDown class="h-4 w-4 text-outline" />
		</span>
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			class="z-50 min-w-[12rem] rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-1.5 shadow-lg"
			sideOffset={6}
		>
			{#each options as option (option.value)}
				<Select.Item
					value={option.value}
					label={option.label}
					class="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-on-surface transition-colors data-[highlighted]:bg-surface-container-high"
				>
					<span
						class="flex h-4 w-4 shrink-0 items-center justify-center rounded border {value.includes(
							option.value
						)
							? 'border-brand-blue bg-brand-blue text-white'
							: 'border-outline-variant bg-transparent'}"
					>
						{#if value.includes(option.value)}
							<Check class="h-3 w-3" />
						{/if}
					</span>
					{option.label}
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Portal>
</Select.Root>
