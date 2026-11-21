<script lang="ts">
	interface Props {
		tab: 'items' | 'persons';
		personCount: number;
		onchange: (tab: 'items' | 'persons') => void;
	}

	let { tab, personCount, onchange }: Props = $props();

	const tabs = $derived([
		{ value: 'items' as const, label: 'Artículos' },
		{ value: 'persons' as const, label: `Personas · ${personCount}` }
	]);
</script>

<div
	role="tablist"
	aria-label="Vista del drawer"
	class="ml-2 inline-flex rounded-md bg-surface-container-high p-0.5"
>
	{#each tabs as option (option.value)}
		<button
			type="button"
			role="tab"
			aria-selected={tab === option.value}
			onclick={() => onchange(option.value)}
			class="rounded px-2.5 py-1 text-xs font-semibold {tab === option.value
				? 'bg-white text-brand-navy shadow-sm'
				: 'text-on-surface-variant'}">{option.label}</button
		>
	{/each}
</div>
