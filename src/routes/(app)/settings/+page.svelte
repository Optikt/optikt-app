<script lang="ts">
	import SettingsPageContent from '$lib/components/config/SettingsPage.svelte';

	let { data } = $props();
</script>

<SettingsPageContent {data} />