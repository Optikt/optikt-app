<script lang="ts">
	import { getFormErrorMessage } from '$lib/utils';
	import type { RemoteFormIssue } from '@sveltejs/kit';

	interface Props {
		issues: RemoteFormIssue[] | undefined;
	}

	let { issues }: Props = $props();
	const message = $derived(getFormErrorMessage(issues ?? null));
</script>

{#if message}
	<p class="form-field-error mt-1 text-xs font-medium text-error">{message}</p>
{/if}
