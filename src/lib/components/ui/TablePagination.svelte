<script lang="ts">
	interface Props {
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		showInfo?: boolean;
		visiblePages?: number;
	}

	let {
		page,
		perPage,
		total,
		totalPages,
		onPageChange,
		showInfo = true,
		visiblePages = 5
	}: Props = $props();

	const from = $derived((page - 1) * perPage + 1);
	const to = $derived(Math.min(page * perPage, total));

	const pages = $derived.by(() => {
		const half = Math.floor(visiblePages / 2);
		let start = Math.max(1, page - half);
		let end = Math.min(totalPages, start + visiblePages - 1);
		if (end - start + 1 < visiblePages) {
			start = Math.max(1, end - visiblePages + 1);
		}
		return Array.from({ length: end - start + 1 }, (_, i) => start + i);
	});

	function handlePageChange(newPage: number) {
		if (newPage >= 1 && newPage <= totalPages) {
			onPageChange(newPage);
		}
	}
</script>

{#if totalPages > 1}
	<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
		{#if showInfo}
			<p class="text-sm text-gray-600">
				Mostrando {from} - {to} de {total}
			</p>
		{/if}
		<div class="flex items-center gap-1">
			<button
				type="button"
				disabled={page <= 1}
				onclick={() => handlePageChange(page - 1)}
				class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
			>
				‹
			</button>
			{#each pages as p (p)}
				<button
					type="button"
					onclick={() => handlePageChange(p)}
					class={[
						'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
						p === page ? 'bg-brand-blue text-white' : 'hover:bg-slate-100'
					].join(' ')}
				>
					{p}
				</button>
			{/each}
			<button
				type="button"
				disabled={page >= totalPages}
				onclick={() => handlePageChange(page + 1)}
				class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
			>
				›
			</button>
		</div>
	</div>
{/if}
