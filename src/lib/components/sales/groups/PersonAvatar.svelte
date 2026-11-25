<script lang="ts">
	import { personColor, personInitials } from './groupsState';

	interface Props {
		label: string | null | undefined;
		index: number;
		size?: 'sm' | 'md' | 'lg';
	}

	let { label, index, size = 'md' }: Props = $props();

	const color = $derived(personColor(index));
	const initials = $derived(personInitials(label, index));
	const sizeClass = $derived(
		size === 'sm'
			? 'h-5 w-5 text-[10px]'
			: size === 'lg'
				? 'h-8 w-8 text-xs'
				: 'h-7 w-7 text-[11px]'
	);
</script>

<span
	aria-hidden="true"
	class="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white {sizeClass}"
	style:background-color={color.dot}>{initials}</span
>
