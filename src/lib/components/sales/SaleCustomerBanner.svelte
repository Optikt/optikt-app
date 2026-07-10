<script lang="ts">
	interface Props {
		name: string;
		document: string;
		statusLabel: string;
	}

	let { name, document, statusLabel }: Props = $props();
</script>

<div
	class="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-white shadow-sm"
>
	<div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
		<span class="max-w-[12rem] truncate">{name}</span>
		<span class="font-mono text-[12px] text-white/80">{document}</span>
	</div>
	<p
		class="rounded-full border-2 px-2 text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase"
	>
		{statusLabel}
	</p>
</div>
