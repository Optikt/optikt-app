<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { LifeBuoy } from '@lucide/svelte';
	import { countOpenSupportTicketsQuery } from '$lib/remote/supportTickets.remote';
	import { isAdminRole, type UserRole } from '$lib/shared/enums';

	let { role }: { role: UserRole } = $props();

	const canManage = $derived(isAdminRole(role));
	let openCount = $state(0);
	const badgeLabel = $derived(openCount > 99 ? '99+' : String(openCount));

	onMount(() => {
		if (!canManage) return;

		let cancelled = false;

		async function loadCount() {
			try {
				const count = await countOpenSupportTicketsQuery();
				if (!cancelled) openCount = count;
			} catch {
				// Badge is best-effort; ignore failures.
			}
		}

		void loadCount();
		const interval = window.setInterval(loadCount, 60_000);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	});
</script>

<button
	type="button"
	class="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:h-10 sm:w-10"
	onclick={() => goto(resolve('/support'))}
	title="Soporte"
	aria-label="Abrir tickets de soporte"
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
