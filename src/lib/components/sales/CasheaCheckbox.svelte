<script lang="ts">
	import { CasheaIsotipo } from '$lib/components/branding';

	let {
		isCashea = $bindable(false),
		class: className = ''
	}: {
		isCashea?: boolean;
		class?: string;
	} = $props();
</script>

<label
	class="flex items-center gap-2 rounded-lg bg-surface-container/60 px-3 py-2.5 text-xs text-on-surface-variant {className}"
>
	<input
		type="checkbox"
		bind:checked={isCashea}
		class="h-4 w-4 rounded border-outline-variant/40 bg-surface-container-lowest accent-brand-blue"
	/>
	<CasheaIsotipo class="h-4 w-4 shrink-0" />
	<span class="font-medium text-on-surface">Venta con Cashea</span>
</label>
