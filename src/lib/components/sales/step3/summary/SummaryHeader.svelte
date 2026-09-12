<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import SaleCustomerBanner from '../../SaleCustomerBanner.svelte';
	import CasheaCheckbox from '../../CasheaCheckbox.svelte';

	interface Props {
		name: string;
		document: string;
		statusLabel: string;
		isCashea: boolean;
		notes: string;
	}

	let {
		name,
		document,
		statusLabel,
		isCashea = $bindable(),
		notes = $bindable()
	}: Props = $props();
</script>

<div class="flex shrink-0 items-center gap-3">
	<SaleCustomerBanner {name} {document} {statusLabel} />
	<CasheaCheckbox bind:isCashea />
	<div
		class="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 transition-colors duration-150 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-100 hover:border-slate-400"
	>
		<FileText class="h-3 w-3 shrink-0 text-slate-400" />
		<input
			type="text"
			bind:value={notes}
			placeholder="Nota de la venta..."
			class="w-full border-0 bg-transparent px-0 py-0 text-xs text-slate-600 placeholder-slate-400 focus:ring-0 focus:outline-none"
		/>
	</div>
</div>
