<script lang="ts">
	import { resolve } from '$app/paths';
	import { ShoppingCart, CreditCard, Eye } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Reportes - Optikt</title>
</svelte:head>

<div class="p-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Reportes</h1>
		<p class="mt-1 text-base text-slate-500">Consulta y exporta datos del negocio</p>
	</div>

	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		<a
			href={resolve('/reports/sales')}
			class="glass-card flex items-start gap-4 p-6 transition-shadow hover:shadow-md"
		>
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white"
			>
				<ShoppingCart size={24} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-slate-800">Ventas por Período</h2>
				<p class="mt-1 text-sm text-slate-500">
					Listado de ventas con totales, filtrado por rango de fechas
				</p>
			</div>
		</a>

		<a
			href={resolve('/reports/payments')}
			class="glass-card flex items-start gap-4 p-6 transition-shadow hover:shadow-md"
		>
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
			>
				<CreditCard size={24} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-slate-800">Pagos Recibidos</h2>
				<p class="mt-1 text-sm text-slate-500">Pagos por período con desglose por método de pago</p>
			</div>
		</a>

		<a
			href={resolve('/reports/inventory')}
			class="glass-card flex items-start gap-4 p-6 transition-shadow hover:shadow-md"
		>
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white"
			>
				<Eye size={24} />
			</div>
			<div>
				<h2 class="text-lg font-semibold text-slate-800">Inventario de Lentes</h2>
				<p class="mt-1 text-sm text-slate-500">Stock actual por ítem, materiales y proveedores</p>
			</div>
		</a>
	</div>
</div>
