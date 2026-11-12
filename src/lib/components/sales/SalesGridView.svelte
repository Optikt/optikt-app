<script lang="ts">
	import SaleCard from '$lib/components/sales/SaleCard.svelte';
	import type { UserRole } from '$lib/shared/enums';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sales: SaleListItem[];
		canManage: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onOpen: (sale: SaleListItem) => void;
		onCancel: (sale: SaleListItem) => void;
	}

	let { sales, canManage, currentUserId, currentUserRole, onOpen, onCancel }: Props = $props();
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
	{#each sales as sale, index (sale.id)}
		<SaleCard {sale} {index} {canManage} {currentUserId} {currentUserRole} {onOpen} {onCancel} />
	{/each}
</div>
