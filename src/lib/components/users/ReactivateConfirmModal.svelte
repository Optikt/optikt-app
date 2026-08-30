<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { reactivateUser } from '$lib/remote/users.remote';
	import { getErrorMessage } from '$lib/utils';
	import type { UserListItem } from '$lib/types/users';
	import type { UserRole } from '$lib/shared/enums';

	interface Props {
		open: boolean;
		candidate: UserListItem | null;
		formData: FormData | null;
		onSuccess?: () => void;
	}

	let { open = $bindable(), candidate, formData, onSuccess }: Props = $props();

	let loading = $state(false);

	function handleCancel() {
		open = false;
	}

	async function handleConfirm() {
		if (!candidate || !formData) return;

		loading = true;
		try {
			await reactivateUser({
				deletedUserId: candidate.id,
				fullName: formData.get('fullName') as string,
				username: formData.get('username') as string,
				email: formData.get('email') as string,
				password: formData.get('password') as string,
				role: formData.get('role') as UserRole
			});
			toast.success('Usuario reactivado exitosamente');
			open = false;
			onSuccess?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error reactivando usuario'));
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Reactivar Usuario Eliminado</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4">
				<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
				<div>
					<p class="font-medium text-yellow-800">Usuario encontrado</p>
					<p class="mt-1 text-sm text-yellow-700">
						El email ingresado pertenece a un usuario que fue eliminado anteriormente. ¿Desea
						reactivar esta cuenta con los nuevos datos?
					</p>
				</div>
			</div>

			{#if candidate}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h4 class="mb-2 text-sm font-medium text-gray-700">Datos del usuario eliminado:</h4>
					<dl class="space-y-1 text-sm">
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Nombre:</dt>
							<dd class="text-gray-900">{candidate.fullName}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Email:</dt>
							<dd class="text-gray-900">{candidate.email}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="font-medium text-gray-600">Usuario:</dt>
							<dd class="text-gray-900">{candidate.username}</dd>
						</div>
					</dl>
				</div>
			{/if}

			<p class="text-sm text-gray-600">
				Si confirma, el usuario será reactivado con los datos que ingresó en el formulario.
			</p>
		</div>

		<Dialog.Footer class="flex justify-end gap-2">
			<Button variant="outline" onclick={handleCancel} disabled={loading}>Cancelar</Button>
			<Button color="yellow" onclick={handleConfirm} disabled={loading}>
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
				Reactivar Usuario
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
