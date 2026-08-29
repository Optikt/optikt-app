<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
</script>

<div class="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-container/80 p-2">
	<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
	<div>
		<p class="text-sm font-semibold text-on-warning-container">Borrador en preparación</p>
		<p class="mt-1 text-xs text-on-surface-variant">
			Revisa cada artículo antes de confirmar. La orden no afectará stock hasta su confirmación.
		</p>
	</div>
</div>
