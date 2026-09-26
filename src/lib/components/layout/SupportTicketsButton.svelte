<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { LifeBuoy, ListChecks, Plus } from '@lucide/svelte';
	import SupportTicketFormModal from '$lib/components/support/SupportTicketFormModal.svelte';
	import { countOpenSupportTicketsQuery } from '$lib/remote/supportTickets.remote';
	import { isAdminRole, type UserRole } from '$lib/shared/enums';

	let { role }: { role: UserRole } = $props();

	const canManage = $derived(isAdminRole(role));
	let openCount = $state(0);
	let menuOpen = $state(false);
	let createOpen = $state(false);
	const badgeLabel = $derived(openCount > 99 ? '99+' : String(openCount));

	async function refreshCount() {
		if (!canManage) return;

		try {
			openCount = await countOpenSupportTicketsQuery();
		} catch {
			// Badge is best-effort; ignore failures.
		}
	}

	onMount(() => {
		if (!canManage) return;

		let cancelled = false;

		async function loadCount() {
			if (cancelled) return;
			await refreshCount();
		}

		void loadCount();
		const interval = window.setInterval(loadCount, 60_000);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-support-menu]')) {
			menuOpen = false;
		}
	}

	function openCreate() {
		menuOpen = false;
		createOpen = true;
	}

	function goToList() {
		menuOpen = false;
		void goto(resolve('/support'));
	}

	function handleCreated() {
		createOpen = false;
		void refreshCount();
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="relative" data-support-menu>
	<button
		type="button"
		class="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:h-10 sm:w-10"
		onclick={() => (menuOpen = !menuOpen)}
		aria-expanded={menuOpen}
		aria-haspopup="menu"
		aria-label="Abrir menú de soporte"
	>
		<LifeBuoy size={20} />
		{#if canManage && openCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-brand-navy"
			>
				{badgeLabel}
			</span>
		{/if}
	</button>

	{#if menuOpen}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
			role="menu"
		>
			<button
				type="button"
				role="menuitem"
				class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
				onclick={openCreate}
			>
				<Plus size={16} />
				Nuevo ticket
			</button>
			<button
				type="button"
				role="menuitem"
				class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
				onclick={goToList}
			>
				<ListChecks size={16} />
				{canManage ? 'Gestionar tickets' : 'Ver mis tickets'}
			</button>
		</div>
	{/if}
</div>

<SupportTicketFormModal
	bind:open={createOpen}
	onCreated={handleCreated}
	onClose={() => (createOpen = false)}
/>
