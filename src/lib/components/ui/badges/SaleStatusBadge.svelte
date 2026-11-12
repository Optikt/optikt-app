<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { getSaleStatusLabel, getSaleStatusBadgeColor } from '$lib/shared/enums';

	interface Props {
		status: string;
		/** Override de texto (p. ej. "DISPONIBLE" en la tabla del listado de ventas). */
		label?: string;
		class?: string;
	}

	let { status, label, class: className = '' }: Props = $props();
</script>

<AppBadge variant={getSaleStatusBadgeColor(status)} class={className}>
	{label ?? getSaleStatusLabel(status)}
</AppBadge>
