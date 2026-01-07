<script lang="ts">
	import { PaginationNav } from 'flowbite-svelte';

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

	// Calculate showing range
	const from = $derived((page - 1) * perPage + 1);
	const to = $derived(Math.min(page * perPage, total));

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
		<PaginationNav currentPage={page} {totalPages} {visiblePages} onPageChange={handlePageChange} />
	</div>
{/if}
