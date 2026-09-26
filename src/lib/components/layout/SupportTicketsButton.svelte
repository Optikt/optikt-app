<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { DropdownMenu } from 'bits-ui';
	import { LifeBuoy, ListChecks, Plus } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import SupportTicketFormModal from '$lib/components/support/SupportTicketFormModal.svelte';

	interface Props {
		canManage?: boolean;
		/** Optional overlay rendered inside the trigger (e.g. open ticket count). */
		badge?: Snippet;
	}

	let { canManage = false, badge }: Props = $props();

	let createOpen = $state(false);

	function openCreate() {
		createOpen = true;
	}

	function goToList() {
		void goto(resolve('/support'));
	}

	function handleCreated() {
		createOpen = false;
		window.dispatchEvent(new CustomEvent('support-tickets-changed'));
	}

	const itemClass =
		'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none select-none data-[highlighted]:bg-slate-50';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white sm:h-10 sm:w-10"
		aria-label="Abrir menú de soporte"
	>
		<LifeBuoy size={20} />
		{@render badge?.()}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={6}
			class="z-[70] w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
		>
			<DropdownMenu.Item class={itemClass} onSelect={openCreate}>
				<Plus size={16} />
				Nuevo ticket
			</DropdownMenu.Item>
			<DropdownMenu.Item class={itemClass} onSelect={goToList}>
				<ListChecks size={16} />
				{canManage ? 'Gestionar tickets' : 'Ver mis tickets'}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<SupportTicketFormModal bind:open={createOpen} onCreated={handleCreated} />
