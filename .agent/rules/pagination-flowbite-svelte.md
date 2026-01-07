---
trigger: always_on
---

# Svelte Pagination - Flowbite

This is a summary because it was too big.

## Setup

```svelte
<script lang="ts">
	import { PaginationNav, Pagination, PaginationItem } from 'flowbite-svelte';
</script>
```

## Default

### PaginationNav

```svelte
<script lang="ts">
	import { PaginationNav } from 'flowbite-svelte';
	import { onMount } from 'svelte';

	let currentPage = $state(1);
	let isMobile = $state(false);
	const totalPages = 20;

	function handlePageChange(page: number) {
		currentPage = page;
		console.log('Page:', page);
	}

	function checkMobile() {
		isMobile = window.innerWidth <= 640;
	}

	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});
</script>

<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange} />

{#if !isMobile}
	<PaginationNav {currentPage} {totalPages} visiblePages={7} onPageChange={handlePageChange} />
	<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange} size="large" />
{/if}
```

### Pagination, PaginationItem

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { Pagination } from 'flowbite-svelte';
	import { onMount } from 'svelte';

	let isMobile = $state(false);
	let activeUrl = $derived(page.url.searchParams.get('page'));
	let pages = $state([
		{ name: '1', href: '/docs/components/pagination?page=1', active: false },
		{ name: '2', href: '/docs/components/pagination?page=2', active: false },
		{ name: '3', href: '/docs/components/pagination?page=3', active: false },
		{ name: '4', href: '/docs/components/pagination?page=4', active: false },
		{ name: '5', href: '/docs/components/pagination?page=5', active: false }
	]);

	$effect(() => {
		pages.forEach((page) => {
			let splitUrl = page.href?.split('?');
			let queryString = splitUrl?.slice(1).join('?');
			const hrefParams = new URLSearchParams(queryString);
			let hrefValue = hrefParams.get('page');
			page.active = hrefValue === activeUrl;
		});
	});

	const previous = () => alert('Previous clicked');
	const next = () => alert('Next clicked');

	function checkMobile() {
		isMobile = window.innerWidth <= 640;
	}

	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});
</script>

<Pagination {pages} {previous} {next} />
{#if !isMobile}
	<Pagination {pages} size="large" {previous} {next} />
{/if}
```

## Icons

### PaginationNav

```svelte
<script lang="ts">
	import { PaginationNav } from 'flowbite-svelte';
	import { ArrowLeftOutline, ArrowRightOutline } from 'flowbite-svelte-icons';

	let currentPage = $state(1);
	const totalPages = 20;

	function handlePageChange(page: number) {
		currentPage = page;
	}
</script>

<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange}>
	{#snippet prevContent()}
		<span class="sr-only">Previous</span>
		<ArrowLeftOutline class="h-5 w-5" />
	{/snippet}
	{#snippet nextContent()}
		<span class="sr-only">Next</span>
		<ArrowRightOutline class="h-5 w-5" />
	{/snippet}
</PaginationNav>

<PaginationNav visiblePages={7} {currentPage} {totalPages} onPageChange={handlePageChange}>
	{#snippet prevContent()}
		<span class="sr-only">Previous</span>
		<ArrowLeftOutline class="h-5 w-5" />
	{/snippet}
	{#snippet nextContent()}
		<span class="sr-only">Next</span>
		<ArrowRightOutline class="h-5 w-5" />
	{/snippet}
</PaginationNav>
```

### Pagination, PaginationItem

```svelte
<script lang="ts">
	import { Pagination } from 'flowbite-svelte';
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';

	let pages = $state([
		{ name: '1', href: '/docs/components/pagination?page=1', active: false },
		{ name: '2', href: '/docs/components/pagination?page=2', active: false },
		{ name: '3', href: '/docs/components/pagination?page=3', active: false },
		{ name: '4', href: '/docs/components/pagination?page=4', active: false },
		{ name: '5', href: '/docs/components/pagination?page=5', active: false }
	]);
	const previous = () => alert('Prev clicked');
	const next = () => alert('Next clicked');
</script>

<div class="flex flex-col items-center justify-center gap-3">
	<Pagination {pages} {previous} {next}>
		{#snippet prevContent()}
			<span class="sr-only">Previous</span>
			<ChevronLeftOutline class="h-5 w-5" />
		{/snippet}
		{#snippet nextContent()}
			<span class="sr-only">Next</span>
			<ChevronRightOutline class="h-5 w-5" />
		{/snippet}
	</Pagination>
</div>
```

## Prev / Next

### PaginationNav

```svelte
<script lang="ts">
	import { PaginationNav, P } from 'flowbite-svelte';
	let currentPage = $state(1);
	const totalPages = 20;
	function handlePageChange(page: number) {
		currentPage = page;
	}
</script>

<P class="text-sm">Showing {currentPage} of {totalPages} Entries</P>
<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange} layout="navigation" />
<PaginationNav
	size="large"
	{currentPage}
	{totalPages}
	onPageChange={handlePageChange}
	layout="navigation"
/>
```

### PaginationItem

```svelte
<script lang="ts">
	import { PaginationItem } from 'flowbite-svelte';
	const previous = () => alert('Prev');
	const next = () => alert('Next');
</script>

<div class="flex space-x-3 rtl:space-x-reverse">
	<PaginationItem onclick={previous}>Previous</PaginationItem>
	<PaginationItem onclick={next}>Next</PaginationItem>
</div>
<div class="flex space-x-3 rtl:space-x-reverse">
	<PaginationItem size="large" onclick={previous}>Previous</PaginationItem>
	<PaginationItem size="large" onclick={next}>Next</PaginationItem>
</div>
```

## Prev / Next (Icons)

### PaginationNav

```svelte
<script lang="ts">
	import { PaginationNav, P } from 'flowbite-svelte';
	import { ArrowLeftOutline, ArrowRightOutline } from 'flowbite-svelte-icons';
	let currentPage = $state(1);
	const totalPages = 20;
	function handlePageChange(page: number) {
		currentPage = page;
	}
</script>

<P class="text-sm">Showing {currentPage} of {totalPages} Entries</P>
<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange} layout="navigation">
	{#snippet prevContent()}
		<ArrowLeftOutline class="h-5 w-5" />
		Previous
	{/snippet}
	{#snippet nextContent()}
		Next
		<ArrowRightOutline class="h-5 w-5" />
	{/snippet}
</PaginationNav>

<PaginationNav
	size="large"
	{currentPage}
	{totalPages}
	onPageChange={handlePageChange}
	layout="navigation"
>
	{#snippet prevContent()}
		<ArrowLeftOutline class="h-5 w-5" />
		Previous
	{/snippet}
	{#snippet nextContent()}
		Next
		<ArrowRightOutline class="h-5 w-5" />
	{/snippet}
</PaginationNav>
```

### PaginationItem

```svelte
<script lang="ts">
	import { PaginationItem } from 'flowbite-svelte';
	import { ArrowLeftOutline, ArrowRightOutline } from 'flowbite-svelte-icons';
	const previous = () => alert('Prev');
	const next = () => alert('Next');
</script>

<div class="flex space-x-3 rtl:space-x-reverse">
	<PaginationItem class="flex items-center" onclick={previous}>
		<ArrowLeftOutline class="me-2 h-3.5 w-3.5" />
		Previous
	</PaginationItem>
	<PaginationItem class="flex items-center" onclick={next}>
		Next
		<ArrowRightOutline class="ms-2 h-3.5 w-3.5" />
	</PaginationItem>
</div>
<div class="flex space-x-3 rtl:space-x-reverse">
	<PaginationItem size="large" class="flex items-center" onclick={previous}>
		<ArrowLeftOutline class="me-2 h-5 w-5" />
		Previous
	</PaginationItem>
	<PaginationItem size="large" class="flex items-center" onclick={next}>
		Next
		<ArrowRightOutline class="ms-2 h-5 w-5" />
	</PaginationItem>
</div>
```

## Table Data

### PaginationNav

```svelte
<script lang="ts">
	import { PaginationNav } from 'flowbite-svelte';
	let currentPage = $state(1);
	const totalPages = 20;
	function handlePageChange(page: number) {
		currentPage = page;
	}
</script>

<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange} layout="table" />
<PaginationNav
	size="large"
	{currentPage}
	{totalPages}
	onPageChange={handlePageChange}
	layout="table"
/>
```

### Pagination (Table)

```svelte
<script lang="ts">
	import { Pagination } from 'flowbite-svelte';
	let helper = { start: 1, end: 10, total: 100 };
	const previous = () => alert('Prev');
	const next = () => alert('Next');
</script>

<div class="flex flex-col items-center justify-center gap-3">
	<div class="flex flex-col items-center justify-center gap-2">
		<div class="text-sm text-gray-700 dark:text-gray-400">
			Showing <span class="font-semibold text-gray-900 dark:text-white">{helper.start}</span>
			to <span class="font-semibold text-gray-900 dark:text-white">{helper.end}</span>
			of <span class="font-semibold text-gray-900 dark:text-white">{helper.total}</span>
			Entries
		</div>
		<Pagination table {previous} {next} />
		<Pagination table size="large" {previous} {next} />
	</div>
</div>
```

## Table Data (Icons)

### PaginationNav

```svelte
<script lang="ts">
	import { PaginationNav } from 'flowbite-svelte';
	import { ArrowLeftOutline, ArrowRightOutline } from 'flowbite-svelte-icons';
	let currentPage = $state(1);
	const totalPages = 20;
	function handlePageChange(page: number) {
		currentPage = page;
	}
</script>

<PaginationNav {currentPage} {totalPages} onPageChange={handlePageChange} layout="table">
	{#snippet prevContent()}
		<ArrowLeftOutline class="h-5 w-5" />
		Previous
	{/snippet}
	{#snippet nextContent()}
		Next
		<ArrowRightOutline class="h-5 w-5" />
	{/snippet}
</PaginationNav>
```

### Pagination (Table + Icons)

```svelte
<script lang="ts">
	import { Pagination } from 'flowbite-svelte';
	import { ArrowLeftOutline, ArrowRightOutline } from 'flowbite-svelte-icons';
	let helper = { start: 1, end: 10, total: 100 };
	const previous = () => alert('Prev');
	const next = () => alert('Next');
</script>

<div class="flex flex-col items-center justify-center gap-3">
	<div class="flex flex-col items-center justify-center gap-2">
		<div class="text-sm text-gray-700 dark:text-gray-400">
			Showing <span class="font-semibold text-gray-900 dark:text-white">{helper.start}</span>
			to <span class="font-semibold text-gray-900 dark:text-white">{helper.end}</span>
			of <span class="font-semibold text-gray-900 dark:text-white">{helper.total}</span>
			Entries
		</div>

		<Pagination table {previous} {next}>
			{#snippet prevContent()}
				<div class="flex items-center gap-2 bg-gray-800 text-white">
					<ArrowLeftOutline class="me-2 h-5 w-5" />
					Prev
				</div>
			{/snippet}
			{#snippet nextContent()}
				<div class="flex items-center gap-2 bg-gray-800 text-white">
					Next
					<ArrowRightOutline class="ms-2 h-5 w-5" />
				</div>
			{/snippet}
		</Pagination>
	</div>
</div>
```

## Component Data

### Pagination Props

- `pages: []`
- `previous: fn`
- `next: fn`
- `prevContent: snippet`
- `nextContent: snippet`
- `table: boolean`
- `size: string`
- `ariaLabel: string`

### PaginationButton Props

- `children`, `size`, `onclick`, `disabled` (default: false), `class`, `href`, `active` (default: false)

### PaginationItem Props

- `children`, `size`, `class`, `href`, `active`

### PaginationNav Props

- `currentPage: number` (1)
- `totalPages: number` (1)
- `visiblePages: number` (5)
- `onPageChange: fn`
- `prevContent: snippet`
- `nextContent: snippet`
- `prevClass: string`
- `nextClass: string`
- `layout: "pagination" | "navigation" | "table"`
- `nextLabel: string` ("Next")
- `previousLabel: string` ("Previous")
- `ariaLabel: string`
- `size: string` ("default")
- `class: string`
- `classes: object` example: ({active})
- `spanClass: string`
- `tableDivClass: string`

```

```
