<script lang="ts">
	import { resolve } from '$app/paths';
	import { LogOut, Menu, Settings, X } from '@lucide/svelte';
	import { ImagotipoHorizontal } from '$lib/components';
	import { logout } from '$lib/remote/auth.remote';
	import { UserRole } from '$lib/shared/enums';
	import { CommandSearch, ExchangeRatesMock, NotificationsMock } from '$lib/components/layout';
	import type { SessionWithUser } from '$lib/server/db/queries/sessions.js';

	type NavbarProps = {
		user: SessionWithUser['user'];
		mobileNavOpen?: boolean;
		onToggleNav?: () => void;
	};

	let { user, mobileNavOpen = false, onToggleNav }: NavbarProps = $props();

	let profileOpen = $state(false);

	function getRoleBadgeClass(role: UserRole) {
		const base =
			'inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-wide';
		switch (role) {
			case UserRole.ADMIN:
				return `${base} text-white bg-gradient-to-r from-violet-500 to-violet-600`;
			case UserRole.MANAGER:
				return `${base} text-white bg-gradient-to-r from-blue-500 to-blue-600`;
			case UserRole.SELLER:
				return `${base} text-white bg-gradient-to-r from-emerald-500 to-emerald-600`;
			default:
				return `${base} text-white bg-gradient-to-r from-gray-500 to-gray-600`;
		}
	}

	function toggleProfile() {
		profileOpen = !profileOpen;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-profile-menu]')) {
			profileOpen = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<header class="sticky top-0 z-50 border-b border-slate-200 bg-brand-navy print:hidden">
	<div class="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-6">
		<button
			type="button"
			onclick={onToggleNav}
			class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white transition-colors hover:bg-white/10 lg:hidden"
			aria-controls="app-mobile-sidebar"
			aria-expanded={mobileNavOpen}
			aria-label={mobileNavOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
		>
			{#if mobileNavOpen}
				<X class="h-5 w-5" />
			{:else}
				<Menu class="h-5 w-5" />
			{/if}
		</button>

		<a href={resolve('/dashboard')} class="flex shrink-0 items-center no-underline">
			<ImagotipoHorizontal theme="light" ariaLabel="Optikt" class="h-7 w-auto sm:h-8" />
		</a>

		<div class="hidden min-w-0 flex-1 md:ml-4 md:block">
			<CommandSearch />
		</div>

		<div class="ml-auto flex items-center gap-2">
			<div class="hidden items-center gap-2 md:flex">
				<ExchangeRatesMock />
				<NotificationsMock />
				<div class="mx-1 h-8 w-px bg-white/10"></div>
			</div>

			<div class="relative" data-profile-menu>
				<button
					type="button"
					class="flex items-center gap-2 rounded-xl border-none px-2 py-1.5 transition-colors hover:bg-white/10"
					onclick={toggleProfile}
				>
					<div class="hidden flex-col items-end sm:flex">
						<span class="max-w-44 truncate text-sm font-medium text-white">{user.fullName}</span>
						<span class={getRoleBadgeClass(user.role)}>{user.role}</span>
					</div>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-blue to-brand-blue-dark text-sm font-semibold text-white"
					>
						{user.fullName?.charAt(0) ?? 'U'}
					</div>
				</button>

				{#if profileOpen}
					<div
						class="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg"
					>
						<div class="border-b border-slate-100 px-4 py-3">
							<p class="text-sm font-semibold text-slate-900">{user.fullName}</p>
							<p class="truncate text-xs text-slate-500">{user.email}</p>
						</div>
						<div class="p-1">
							<a
								href={resolve('/settings')}
								class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 no-underline transition-colors hover:bg-slate-50"
								onclick={() => (profileOpen = false)}
							>
								<Settings size={16} />
								Configuración
							</a>
						</div>
						<div class="border-t border-slate-100 p-1">
							<form {...logout} class="contents">
								<button
									type="submit"
									class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
								>
									<LogOut size={16} />
									Cerrar sesión
								</button>
							</form>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="border-t border-white/10 px-4 pb-3 sm:px-6 md:hidden">
		<CommandSearch />
	</div>
</header>
