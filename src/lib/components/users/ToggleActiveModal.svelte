<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { UserCheck, UserX } from '@lucide/svelte';

	interface Props {
		open: boolean;
		userName: string;
		isActive: boolean;
		loading?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		userName,
		isActive,
		loading = false,
		onConfirm,
		onCancel
	}: Props = $props();

	const action = $derived(isActive ? 'desactivar' : 'activar');
	const Icon = $derived(isActive ? UserX : UserCheck);
	const color = $derived(isActive ? 'yellow' : 'green');
</script>

<Modal bind:open size="sm" title={isActive ? 'Desactivar Usuario' : 'Activar Usuario'}>
	<div class="flex items-start gap-3">
		<div
			class={[
				'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
				isActive ? 'bg-yellow-100' : 'bg-green-100'
			]}
		>
			<Icon class={['h-5 w-5', isActive ? 'text-yellow-600' : 'text-green-600']} />
		</div>
		<div>
			<p class="text-gray-700">
				¿Está seguro que desea <strong>{action}</strong> al usuario
				<strong>{userName}</strong>?
			</p>
			{#if isActive}
				<p class="mt-1 text-sm text-gray-500">
					El usuario no podrá iniciar sesión hasta que sea activado nuevamente.
				</p>
			{:else}
				<p class="mt-1 text-sm text-gray-500">El usuario podrá iniciar sesión nuevamente.</p>
			{/if}
		</div>
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={onCancel} disabled={loading}>Cancelar</Button>
		<Button {color} onclick={onConfirm} disabled={loading}>
			{#if loading}<Spinner size="4" class="mr-2" />{/if}
			{isActive ? 'Desactivar' : 'Activar'}
		</Button>
	</div>
</Modal>
