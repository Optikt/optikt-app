<script lang="ts">
	import type { LogoProps } from './palette';

	let {
		primaryColor = '#FFF212',
		secondaryColor = '#373435',
		class: className = '',
		width,
		height,
		title,
		ariaLabel
	}: LogoProps = $props();

	const accessibleLabel = $derived(ariaLabel ?? title);
	const isDecorative = $derived(!accessibleLabel);
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 3019.55 3011.71"
	{width}
	{height}
	class={className}
	fill="none"
	role={isDecorative ? undefined : 'img'}
	aria-label={accessibleLabel}
	aria-hidden={isDecorative}
	preserveAspectRatio="xMidYMid meet"
>
	{#if title}
		<title>{title}</title>
	{/if}

	<rect fill={primaryColor} width="3019.55" height="3011.71" rx="807.83" ry="807.83" />
	<path
		fill={secondaryColor}
		d="M2410.21 1521.54c-9.08,483.77 -404.02,873.16 -889.96,873.16 -491.63,0 -890.18,-398.55 -890.18,-890.18 0,-488.13 392.91,-884.43 879.71,-890.05l0 445.75c-240.61,5.56 -433.96,202.35 -433.96,444.29 0,245.45 198.98,444.43 444.43,444.43 239.75,0 435.12,-189.85 444.07,-427.41l445.89 0z"
	/>
</svg>
