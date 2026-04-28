<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-white text-black">
	<div class="mx-auto min-h-screen w-full max-w-[210mm] px-6 py-8 print:max-w-none print:px-0 print:py-0">
		{@render children()}
	</div>
</div>

<style>
	:global(body) {
		background: white;
		color: black;
	}

	@page {
		size: A4;
		margin: 12mm;
	}

	:global(table) {
		page-break-inside: auto;
	}

	:global(tr),
	:global(img) {
		page-break-inside: avoid;
	}

	:global(thead) {
		display: table-header-group;
	}

	:global(tfoot) {
		display: table-footer-group;
	}

	@media print {
		:global(html),
		:global(body) {
			background: white;
		}
	}
</style>