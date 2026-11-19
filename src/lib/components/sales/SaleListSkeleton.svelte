<script lang="ts">
	/**
	 * Esqueleto neutro mostrado mientras el contenedor de la página no tiene
	 * medición (`isNarrow === null`): evita el flash de escritorio en teléfono
	 * sin adelantar la estructura de ninguna de las dos plantillas.
	 */
</script>

<div class="flex flex-col gap-3" aria-hidden="true">
	<div
		class="h-10 w-1/2 animate-pulse rounded-[var(--ds-radius-md)] bg-surface-container-high"
	></div>
	<div
		class="h-[84px] w-full animate-pulse rounded-[var(--ds-radius-lg)] bg-surface-container-high"
	></div>
	<div
		class="h-11 w-full animate-pulse rounded-[var(--ds-radius-md)] bg-surface-container-high"
	></div>
	{#each Array(4) as _, i (i)}
		<div
			class="h-[88px] w-full animate-pulse rounded-[var(--ds-radius-lg)] bg-surface-container-high"
		></div>
	{/each}
</div>
