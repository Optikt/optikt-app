<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
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

<Modal bind:open size="sm" title={user?.isActive ? 'Desactivar Usuario' : 'Activar Usuario'}>
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

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={handleCancel} disabled={loading}>Cancelar</Button>
		<Button {color} onclick={handleConfirm} disabled={loading}>
			{#if loading}<Spinner size="4" class="mr-2" />{/if}
			{user?.isActive ? 'Desactivar' : 'Activar'}
		</Button>
	</div>
</Modal>
