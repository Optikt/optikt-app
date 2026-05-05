<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-white text-black">
	<div
		class="mx-auto min-h-screen w-full max-w-[210mm] px-6 py-8 print:mx-auto print:min-h-0 print:w-[186mm] print:max-w-[186mm] print:px-0 print:py-0"
	>
		{@render children()}
	</div>
</div>

<style>
	:global(html),
	:global(body) {
		background: white;
		color: black;
		margin: 0;
		padding: 0;
	}

	@page {
		size: A4;
		margin: 2mm 12mm 12mm;
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
