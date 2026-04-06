<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import type { BadgeVariant } from '$lib/shared/badge-variants';

	type TreatmentType = 'antiReflective' | 'blueBlock' | 'photochromic' | 'other';

	interface Props {
		/** The treatment type */
		type: TreatmentType;
		/** For 'other' type, the custom value to display */
		value?: string;
		/** Additional CSS classes */
		class?: string;
	}

	let { type, value = '', class: className = '' }: Props = $props();

	const treatmentConfig: Record<TreatmentType, { variant: BadgeVariant; label: string }> = {
		antiReflective: { variant: 'info', label: 'Antireflejo' },
		blueBlock: { variant: 'info', label: 'Blueblock' },
		photochromic: { variant: 'purple', label: 'Fotocromático' },
		other: { variant: 'neutral', label: 'Otros' }
	};

	const config = $derived(treatmentConfig[type]);
</script>

<AppBadge variant={config.variant} class={className}>
	{type === 'other' && value ? `${config.label}: ${value}` : config.label}
</AppBadge>
