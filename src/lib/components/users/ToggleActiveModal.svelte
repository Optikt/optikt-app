<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { UserCheck, UserX } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { toggleUserActive } from '$lib/remote/users.remote';
	import { getErrorMessage } from '$lib/utils';
	import type { UserListItem } from '$lib/types/users';

	interface Props {
		open: boolean;
		user: UserListItem | null;
		onSuccess?: () => void;
	}

	let { open = $bindable(), user, onSuccess }: Props = $props();

	let loading = $state(false);

	const action = $derived(user?.isActive ? 'desactivar' : 'activar');
	const Icon = $derived(user?.isActive ? UserX : UserCheck);
	const color = $derived(user?.isActive ? 'yellow' : 'green');

	function handleCancel() {
		open = false;
	}

	async function handleConfirm() {
		if (!user) return;

		loading = true;
		try {
			await toggleUserActive({ id: user.id });
			toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
			open = false;
			onSuccess?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cambiando estado'));
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{user?.isActive ? 'Desactivar Usuario' : 'Activar Usuario'}</Dialog.Title>
		</Dialog.Header>
		<div class="flex items-start gap-3">
			<div
				class={[
					'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
					user?.isActive ? 'bg-yellow-100' : 'bg-green-100'
				]}
			>
				<Icon class={['h-5 w-5', user?.isActive ? 'text-yellow-600' : 'text-green-600']} />
			</div>
			<div>
				<p class="text-gray-700">
					¿Está seguro que desea <strong>{action}</strong> al usuario
					<strong>{user?.fullName}</strong>?
				</p>
				{#if user?.isActive}
					<p class="mt-1 text-sm text-gray-500">
						El usuario no podrá iniciar sesión hasta que sea activado nuevamente.
					</p>
				{:else}
					<p class="mt-1 text-sm text-gray-500">El usuario podrá iniciar sesión nuevamente.</p>
				{/if}
			</div>
		</div>

		<Dialog.Footer class="flex justify-end gap-2">
			<Button variant="outline" onclick={handleCancel} disabled={loading}>Cancelar</Button>
			<Button {color} onclick={handleConfirm} disabled={loading}>
				{#if loading}<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
						><circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/><path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/></svg
					>{/if}
				{user?.isActive ? 'Desactivar' : 'Activar'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
