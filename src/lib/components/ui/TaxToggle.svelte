<script lang="ts">
	interface Props {
		checked: boolean;
		/** Label shown next to the toggle. */
		label?: string;
		/** Name attribute for the hidden isTaxable input. Set to null to skip the hidden input. */
		name?: string | null;
		/** aria-label for the toggle button. */
		ariaLabel?: string;
		ontoggle?: (checked: boolean) => void;
	}

	let {
		checked = $bindable(),
		label = 'Gravable (IVA)',
		name = 'isTaxable',
		ariaLabel = label,
		ontoggle
	}: Props = $props();

	function toggle() {
		checked = !checked;
		ontoggle?.(checked);
	}
</script>

<div class="flex items-center gap-4">
	{#if name}
		<input type="hidden" {name} value={String(checked)} />
	{/if}
	<label class="flex cursor-pointer items-center gap-2">
		<button
			type="button"
			class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none {checked
				? 'bg-blue-600'
				: 'bg-slate-200'}"
			onclick={toggle}
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
		>
			<span
				class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 {checked
					? 'translate-x-4'
					: 'translate-x-0'}"
			></span>
		</button>
		<span class="text-sm text-slate-700">{label}</span>
	</label>
</div>
