<script lang="ts">
	import { CasheaIsotipo } from '$lib/components/branding';

	let {
		isCashea = $bindable(false),
		label = 'Venta con Cashea',
		disabled = false,
		variant = 'default' as 'default' | 'gold',
		class: className = ''
	}: {
		isCashea?: boolean;
		label?: string;
		disabled?: boolean;
		variant?: 'default' | 'gold';
		class?: string;
	} = $props();

	const bg = $derived(variant === 'gold' ? 'bg-brand-gold/10' : 'bg-surface-container/60');
</script>

<label
	class="flex items-center gap-2 rounded-lg {bg} px-3 py-2.5 text-xs text-on-surface-variant {className}"
>
	<input
		type="checkbox"
		bind:checked={isCashea}
		{disabled}
		class="h-4 w-4 rounded border-outline-variant/40 bg-surface-container-lowest accent-brand-blue"
	/>
	<CasheaIsotipo class="h-4 w-4 shrink-0" />
	<span class="font-medium text-on-surface">{label}</span>
</label>
