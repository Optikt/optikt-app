<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { isAdminRole } from '$lib/shared/enums';
	import { ProfileSettingsCard, BusinessSettingsCard } from '$lib/components/config';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	// Get user from parent layout
	const user = $derived(data.user);
	const settings = $derived(data.settings);
	const isAdmin = $derived(isAdminRole(user?.role));

	function handleUpdate() {
		untrack(() => {
			invalidateAll();
		});
	}
</script>

<svelte:head>
	<title>Configuración - Optikt</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-900">Configuración</h1>
		<p class="text-slate-500">
			{#if isAdmin}
				Administra tu perfil y configuración del sistema
			{:else}
				Administra tu perfil
			{/if}
		</p>
	</div>

	<div class="space-y-6">
		<!-- Profile Settings (visible to all users) -->
		{#if user}
			<ProfileSettingsCard {user} onUpdate={handleUpdate} />
		{/if}

		<!-- Business Settings (admin only) -->
		{#if isAdmin}
			<BusinessSettingsCard {settings} onUpdate={handleUpdate} />
		{/if}
	</div>
</div>
