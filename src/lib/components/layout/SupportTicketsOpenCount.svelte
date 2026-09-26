<script lang="ts">
	import { onMount } from 'svelte';
	import { countOpenSupportTicketsQuery } from '$lib/remote/supportTickets.remote';

	let openCount = $state(0);
	const badgeLabel = $derived(openCount > 99 ? '99+' : String(openCount));

	async function refreshCount() {
		try {
			openCount = await countOpenSupportTicketsQuery();
		} catch {
			// Badge is best-effort; ignore failures.
		}
	}

	onMount(() => {
		let cancelled = false;

		async function loadCount() {
			if (!cancelled) {
				await refreshCount();
			}
		}

		void loadCount();
		const interval = window.setInterval(loadCount, 60_000);
		window.addEventListener('support-tickets-changed', loadCount);
		window.addEventListener('focus', loadCount);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
			window.removeEventListener('support-tickets-changed', loadCount);
			window.removeEventListener('focus', loadCount);
		};
	});
</script>

{#if openCount > 0}
	<span
		class="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-brand-navy"
	>
		{badgeLabel}
	</span>
{/if}
