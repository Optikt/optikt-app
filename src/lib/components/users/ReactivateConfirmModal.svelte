<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { AlertTriangle } from '@lucide/svelte';
	import type { UserListItem } from '$lib/types/users';

	interface Props {
		open: boolean;
		user: UserListItem | null;
		loading?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { open = $bindable(), user, loading = false, onConfirm, onCancel }: Props = $props();
</script>

<Modal bind:open size="md" title="Reactivar Usuario Eliminado">
	<div class="space-y-4">
		<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
			<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
			<div>
				<p class="font-medium text-yellow-800">Usuario encontrado</p>
				<p class="mt-1 text-sm text-yellow-700">
					El email ingresado pertenece a un usuario que fue eliminado anteriormente. ¿Desea
					reactivar esta cuenta con los nuevos datos?
				</p>
			</div>
		</div>

		{#if user}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<h4 class="mb-2 text-sm font-medium text-gray-700">Datos del usuario eliminado:</h4>
				<dl class="space-y-1 text-sm">
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Nombre:</dt>
						<dd class="text-gray-900">{user.fullName}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Email:</dt>
						<dd class="text-gray-900">{user.email}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="font-medium text-gray-600">Usuario:</dt>
						<dd class="text-gray-900">{user.username}</dd>
					</div>
				</dl>
			</div>
		{/if}

		<p class="text-sm text-gray-600">
			Si confirma, el usuario será reactivado con los datos que ingresó en el formulario.
		</p>
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={onCancel} disabled={loading}>Cancelar</Button>
		<Button color="yellow" onclick={onConfirm} disabled={loading}>
			{#if loading}<Spinner size="4" class="mr-2" />{/if}
			Reactivar Usuario
		</Button>
	</div>
</Modal>
