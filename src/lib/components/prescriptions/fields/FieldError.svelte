<script lang="ts">
	import type { RemoteFormIssue } from '$app/server';
	import { getFormErrorMessage } from '#lib/utils/index.js';

	interface Props {
		issues: RemoteFormIssue[] | undefined;
	}

	let { issues }: Props = $props();
	const message = $derived(getFormErrorMessage(issues ?? null));
</script>

{#if message}
	<p class="form-field-error mt-1 text-xs font-medium text-error">{message}</p>
{/if}
