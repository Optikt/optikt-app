<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UserRole } from '$lib/shared/enums';
	import ProfileSettingsCard from './ProfileSettingsCard.svelte';
	import BusinessSettingsCard from './BusinessSettingsCard.svelte';
	import { untrack } from 'svelte';

	let { data } = $props();

	const user = $derived(data.user);
	const settings = $derived(data.settings ?? null);
	const isUserAdmin = $derived(user?.role === UserRole.ADMIN);

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
			{#if isUserAdmin}
				Administra tu perfil y configuración del sistema
			{:else}
				Administra tu perfil
			{/if}
		</p>
	</div>

	<div class="space-y-6">
		{#if user}
			<ProfileSettingsCard {user} onUpdate={handleUpdate} />
		{/if}

		{#if isUserAdmin && settings}
			<BusinessSettingsCard {settings} onUpdate={handleUpdate} />
		{/if}
	</div>
</div>