<script lang="ts">
	import { Badge } from 'flowbite-svelte';

	type TreatmentType = 'antiReflective' | 'blueBlock' | 'photochromic' | 'other';

	interface Props {
		/** The treatment type */
		type: TreatmentType;
		/** For 'other' type, the custom value to display */
		value?: string;
		/** Badge size */
		size?: 'xs' | 'sm' | 'default';
		/** Additional CSS classes */
		class?: string;
	}

	let { type, value = '', size = 'xs', class: className = '' }: Props = $props();

	const treatmentConfig: Record<
		TreatmentType,
		{ color: 'indigo' | 'blue' | 'purple' | 'gray'; label: string }
	> = {
		antiReflective: { color: 'indigo', label: 'Antireflejo' },
		blueBlock: { color: 'blue', label: 'Blueblock' },
		photochromic: { color: 'purple', label: 'Fotocromático' },
		other: { color: 'gray', label: 'Otros' }
	};

	const config = $derived(treatmentConfig[type]);

	const sizeClasses: Record<string, string> = {
		xs: 'text-xs',
		sm: 'text-sm',
		default: ''
	};
</script>

<Badge color={config.color} class="{sizeClasses[size]} {className}">
	{type === 'other' && value ? `${config.label}: ${value}` : config.label}
</Badge>
