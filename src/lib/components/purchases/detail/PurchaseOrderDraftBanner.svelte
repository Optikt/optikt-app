<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
</script>

<div
	class="rounded-xl bg-warning-container/80 border border-warning/30 p-2 animate-slide-up d3 flex items-start gap-3"
>
	<TriangleAlert class="h-5 w-5 shrink-0 text-warning mt-0.5" />
	<div>
		<p class="text-sm font-semibold text-on-warning-container">Borrador en preparación</p>
		<p class="mt-1 text-xs text-on-surface-variant">
			Revisa cada artículo antes de confirmar. La orden no afectará stock hasta su confirmación.
		</p>
	</div>
</div>
