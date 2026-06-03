<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Bell, CircleAlert, CircleCheck, Info, XCircle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		fetchMyNotifications,
		fetchUnreadNotificationsCount,
		markAllNotificationsReadCommand,
		markNotificationReadCommand
	} from '$lib/remote/notifications.remote';
	import { fromISO, nowISO, toRelative } from '$lib/dates';
	import type { NotificationListItem } from '$lib/server/db/queries/notifications';
	import { NotificationSeverity } from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';

	let open = $state(false);
	let loading = $state(false);
	let loaded = $state(false);
	let markingAll = $state(false);
	let tick = $state(0);
	let notifications = $state<NotificationListItem[]>([]);
	let unreadCount = $state(0);
	let loadError = $state<string | null>(null);

	const badgeLabel = $derived(unreadCount > 99 ? '99+' : String(unreadCount));

	const severityUi = {
		[NotificationSeverity.INFO]: {
			icon: Info,
			className: 'bg-info-container text-on-info-container'
		},
		[NotificationSeverity.SUCCESS]: {
			icon: CircleCheck,
			className: 'bg-success-container text-on-success-container'
		},
		[NotificationSeverity.WARNING]: {
			icon: CircleAlert,
			className: 'bg-warning-container text-on-warning-container'
		},
		[NotificationSeverity.ERROR]: {
			icon: XCircle,
			className: 'bg-error-container text-on-error-container'
		}
	} as const;

	async function loadNotifications(options: { silent?: boolean; imperative?: boolean } = {}) {
		const { silent = false, imperative = false } = options;

		if (!silent && notifications.length === 0) {
			loading = true;
		}

		try {
			const [nextNotifications, nextUnreadCount] = await Promise.all([
				imperative ? fetchMyNotifications().run() : fetchMyNotifications(),
				imperative ? fetchUnreadNotificationsCount().run() : fetchUnreadNotificationsCount()
			]);

			notifications = nextNotifications;
			unreadCount = nextUnreadCount;
			loadError = null;
		} catch (error) {
			loadError = getErrorMessage(error, 'No se pudieron cargar las notificaciones');
			if (!silent) {
				console.error(error);
				toast.error(loadError);
			}
		} finally {
			loading = false;
			loaded = true;
		}
	}

	function toggle() {
		open = !open;
		if (open && !loaded) {
			void loadNotifications({ imperative: true });
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-notifications]')) {
			open = false;
		}
	}

	function relativeTime(iso: string, _tick: number) {
		return toRelative(fromISO(iso));
	}

	function markReadLocally(id: string) {
		const optimisticReadAt = nowISO();
		let decremented = false;

		notifications = notifications.map((notification) => {
			if (notification.id !== id || notification.readAt) {
				return notification;
			}

			decremented = true;
			return {
				...notification,
				readAt: optimisticReadAt
			};
		});

		if (decremented) {
			unreadCount = Math.max(0, unreadCount - 1);
		}
	}

	async function handleNotificationClick(notification: NotificationListItem) {
		if (!notification.readAt) {
			markReadLocally(notification.id);
			try {
				await markNotificationReadCommand({ id: notification.id });
			} catch (error) {
				console.error(error);
				toast.error(getErrorMessage(error, 'No se pudo marcar la notificación'));
				void loadNotifications({ silent: true, imperative: true });
			}
		}

		if (notification.link) {
			open = false;
			await goto(resolve(notification.link));
		}
	}

	async function handleMarkAll(event: MouseEvent) {
		event.stopPropagation();
		markingAll = true;

		try {
			await markAllNotificationsReadCommand({});
			notifications = notifications.map((notification) => ({
				...notification,
				readAt: notification.readAt ?? nowISO()
			}));
			unreadCount = 0;
			toast.success('Notificaciones marcadas como leídas');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'No se pudieron marcar las notificaciones'));
			void loadNotifications({ silent: true, imperative: true });
		} finally {
			markingAll = false;
		}
	}

	$effect(() => {
		untrack(() => void loadNotifications());

		const pollInterval = window.setInterval(() => {
			void loadNotifications({ silent: true, imperative: true });
			tick += 1;
		}, 30_000);

		return () => {
			window.clearInterval(pollInterval);
		};
	});
</script>

<svelte:document onclick={handleClickOutside} />

<div class="relative" data-notifications>
	<button
		type="button"
		class="relative rounded p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
		onclick={toggle}
		title="Notificaciones"
		aria-expanded={open}
		aria-label="Abrir notificaciones"
	>
		<Bell size={20} />
		{#if unreadCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
			>
				{badgeLabel}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-[26rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
				<div>
					<h3 class="text-sm font-semibold text-brand-navy">Notificaciones</h3>
					<p class="mt-0.5 text-[11px] text-slate-400">Eventos visibles según tu rol</p>
				</div>
				<button
					type="button"
					class="text-xs font-medium text-brand-blue transition-colors hover:text-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleMarkAll}
					disabled={markingAll || unreadCount === 0}
				>
					Marcar todas como leídas
				</button>
			</div>

			{#if loading && notifications.length === 0}
				<div class="space-y-3 p-4">
					{#each [1, 2, 3] as row (row)}
						<div class="flex gap-3 rounded-lg px-1 py-1">
							<div class="h-10 w-10 animate-pulse rounded-full bg-slate-100"></div>
							<div class="flex-1 space-y-2">
								<div class="h-4 w-3/4 animate-pulse rounded bg-slate-100"></div>
								<div class="h-3 w-full animate-pulse rounded bg-slate-100"></div>
								<div class="h-3 w-24 animate-pulse rounded bg-slate-100"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if notifications.length > 0}
				<div class="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
					{#each notifications as notification (notification.id)}
						{@const ui = severityUi[notification.severity]}
						{@const Icon = ui.icon}
						<button
							type="button"
							class={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${notification.readAt ? 'opacity-60' : ''}`}
							onclick={() => handleNotificationClick(notification)}
						>
							<div
								class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ui.className}`}
							>
								<Icon size={15} />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-3">
									<p class="text-sm font-medium text-slate-800">{notification.title}</p>
									{#if !notification.readAt}
										<span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-blue"></span>
									{/if}
								</div>
								{#if notification.body}
									<p class="mt-0.5 text-xs leading-relaxed text-slate-500">{notification.body}</p>
								{/if}
								<p class="mt-1 text-xs text-slate-400">
									{relativeTime(notification.createdAt, tick)}
								</p>
							</div>
						</button>
					{/each}
				</div>
			{:else}
				<div class="px-4 py-6 text-center">
					<p class="text-sm font-medium text-slate-700">Sin notificaciones</p>
					<p class="mt-1 text-xs text-slate-400">
						{loadError ?? 'Cuando se generen eventos del sistema aparecerán aquí.'}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
