<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4">
	<p class="text-6xl font-bold text-slate-300">{page.status}</p>
	<h1 class="mt-4 text-xl font-semibold text-slate-800">
		{#if page.status === 404}
			Página no encontrada
		{:else if page.status === 403}
			Acceso denegado
		{:else if page.status === 500}
			Error del servidor
		{:else}
			Algo salió mal
		{/if}
	</h1>
	<p class="mt-2 text-sm text-slate-500">{page.error?.message ?? 'Error inesperado'}</p>
	<a
		href={resolve('/')}
		class="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
	>
		<ArrowLeft size={16} />
		Volver al inicio
	</a>
</div>
