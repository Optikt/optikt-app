<script lang="ts">
	import AuditEventsDrawer from '$lib/components/sales/detail/AuditEventsDrawer.svelte';
	import type { AuditEvent } from '$lib/utils/saleDetail';

	/** Historial del presupuesto: mismo drawer y detalle que ventas. */
	interface Props {
		open: boolean;
		events: AuditEvent[];
		onclose: () => void;
		createdBy?: string | null;
		createdAt: string;
		/** Evento abierto expandido (link «N cambios →» del rail). */
		expandedEventId?: string | null;
	}

	let { open, events, onclose, createdBy, createdAt, expandedEventId = null }: Props = $props();
</script>

<AuditEventsDrawer
	{open}
	{onclose}
	{events}
	createdLabel="Creado por"
	{createdBy}
	{createdAt}
	{expandedEventId}
/>
