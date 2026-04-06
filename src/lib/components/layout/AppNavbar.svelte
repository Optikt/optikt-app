<script lang="ts">
	import { resolve } from '$app/paths';
	import { Settings, LogOut } from '@lucide/svelte';
	import { logout } from '$lib/remote/auth.remote';
	import { UserRole } from '$lib/shared/enums';
	import { CommandSearch, ExchangeRatesMock, NotificationsMock } from '$lib/components/layout';
	import type { SessionWithUser } from '$lib/server/db/queries/sessions.js';

	type NavbarProps = {
		user: SessionWithUser['user'];
	};

	let { user }: NavbarProps = $props();

	let profileOpen = $state(false);

	function getRoleBadgeClass(role: UserRole) {
		const base =
			'inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-wide';
		switch (role) {
			case UserRole.SUPERADMIN:
				return `${base} text-white bg-gradient-to-r from-amber-500 to-amber-600`;
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

<header
	class="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-slate-200 bg-brand-navy px-6 print:hidden"
>
	<!-- Logo -->
	<a href={resolve('/dashboard')} class="flex shrink-0 items-center no-underline">
		<img
			src="/imagotipos/horizontal/optikt-white-yellow.png"
			alt="Optikt"
			class="h-7 object-contain"
		/>
	</a>

	<!-- Search -->
	<div class="ml-6 flex-1">
		<CommandSearch />
	</div>

	<!-- Right actions -->
	<div class="flex items-center gap-2">
		<ExchangeRatesMock />
		<NotificationsMock />

		<!-- Separator -->
		<div class="mx-1 h-8 w-px bg-white/10"></div>

		<!-- User profile -->
		<div class="relative" data-profile-menu>
			<button
				type="button"
				class="flex items-center gap-2.5 rounded-lg border-none px-2 py-1.5 transition-colors hover:bg-white/10"
				onclick={toggleProfile}
			>
				<div class="flex flex-col items-end">
					<span class="text-sm font-medium text-white">{user.fullName}</span>
					<span class={getRoleBadgeClass(user.role)}>{user.role}</span>
				</div>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-blue to-brand-blue-dark font-semibold text-white"
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
							href={resolve('/config')}
							class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 no-underline transition-colors hover:bg-slate-50"
							onclick={() => (profileOpen = false)}
						>
							<Settings size={16} />
							Settings
						</a>
					</div>
					<div class="border-t border-slate-100 p-1">
						<form {...logout} class="contents">
							<button
								type="submit"
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
							>
								<LogOut size={16} />
								Logout
							</button>
						</form>
					</div>
				</div>
			{/if}
		</div>
	</div>
</header>
