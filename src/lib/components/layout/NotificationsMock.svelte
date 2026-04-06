<script lang="ts">
	import { Bell, CircleAlert, CircleCheck, Clock } from '@lucide/svelte';

	let open = $state(false);

	type Notification = {
		id: string;
		icon: 'alert' | 'success' | 'clock';
		title: string;
		description: string;
		time: string;
	};

	const notifications: Notification[] = [
		{
			id: '1',
			icon: 'alert',
			title: 'Stock bajo: Ray-Ban Aviator Gold',
			description: 'Solo quedan 2 unidades disponibles.',
			time: 'Hace 5 minutos'
		},
		{
			id: '2',
			icon: 'success',
			title: 'Nueva venta completada: Ricardo Mendoza',
			description: 'Venta #8842 por $4,250.00 USD.',
			time: 'Hace 1 hora'
		},
		{
			id: '3',
			icon: 'clock',
			title: 'Presupuesto por vencer: #8842',
			description: 'Vence mañana a las 10:00 AM.',
			time: 'Hace 3 horas'
		}
	];

	const iconMap = {
		alert: CircleAlert,
		success: CircleCheck,
		clock: Clock
	};

	const iconColorMap = {
		alert: 'text-warning bg-warning-container',
		success: 'text-success bg-success-container',
		clock: 'text-info bg-info-container'
	};

	function toggle() {
		open = !open;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-notifications]')) {
			open = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="relative" data-notifications>
	<button
		type="button"
		class="relative rounded p-2 text-white/70 transition-colors hover:bg-white/10"
		onclick={toggle}
		title="Notificaciones"
	>
		<Bell size={20} />
		<span
			class="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white"
		>
			{notifications.length}
		</span>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
				<h3 class="text-sm font-semibold text-brand-navy">Notificaciones</h3>
				<button
					type="button"
					class="text-xs text-brand-blue transition-colors hover:text-brand-blue-dark"
					onclick={(e) => e.stopPropagation()}
				>
					Marcar todas como leídas
				</button>
			</div>
			<div class="max-h-80 divide-y divide-slate-100 overflow-y-auto">
				{#each notifications as notification (notification.id)}
					{@const IconComponent = iconMap[notification.icon]}
					<div class="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {iconColorMap[
								notification.icon
							]}"
						>
							<IconComponent size={14} />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-slate-800">{notification.title}</p>
							<p class="mt-0.5 text-xs text-slate-500">{notification.description}</p>
							<p class="mt-1 text-xs text-slate-400">{notification.time}</p>
						</div>
					</div>
				{/each}
			</div>
			<div class="border-t border-slate-100 p-3 text-center">
				<button
					type="button"
					class="text-xs font-semibold tracking-wide text-brand-blue uppercase transition-colors hover:text-brand-blue-dark"
					onclick={(e) => e.stopPropagation()}
				>
					Ver todas las notificaciones
				</button>
			</div>
		</div>
	{/if}
</div>
