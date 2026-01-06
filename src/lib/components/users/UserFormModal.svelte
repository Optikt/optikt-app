<script lang="ts">
	import { Modal, Label, Input, Select, Button, Spinner } from 'flowbite-svelte';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	import type { UserListItem } from '$lib/types/users';

	interface Props {
		open: boolean;
		user?: UserListItem | null; // null = create mode, user = edit mode
		loading?: boolean;
		error?: string | null;
		onSubmit: (data: FormData) => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		user = null,
		loading = false,
		error = null,
		onSubmit,
		onClose
	}: Props = $props();

	let formData = $state({
		fullName: '',
		username: '',
		email: '',
		password: '',
		role: UserRole.VIEWER as UserRole,
		isActive: true
	});

	// Reset form when modal opens or user changes
	$effect(() => {
		if (open) {
			if (user) {
				formData = {
					fullName: user.fullName,
					username: user.username,
					email: user.email,
					password: '',
					role: user.role,
					isActive: user.isActive
				};
			} else {
				formData = {
					fullName: '',
					username: '',
					email: '',
					password: '',
					role: UserRole.VIEWER,
					isActive: true
				};
			}
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		const data = new FormData();
		if (user) data.set('id', user.id);
		data.set('fullName', formData.fullName);
		data.set('username', formData.username);
		data.set('email', formData.email);
		if (formData.password) data.set('password', formData.password);
		data.set('role', formData.role);
		data.set('isActive', formData.isActive ? 'true' : 'false');
		onSubmit(data);
	}

	const isEditMode = $derived(!!user);
	const title = $derived(isEditMode ? 'Editar Usuario' : 'Agregar Usuario');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Usuario');
</script>

<Modal bind:open size="md" {title}>
	<form onsubmit={handleSubmit} class="space-y-4">
		{#if error}
			<div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
		{/if}

		<div class="grid grid-cols-2 gap-4">
			<div>
				<Label for="fullName">Nombre Completo</Label>
				<Input id="fullName" bind:value={formData.fullName} required />
			</div>
			<div>
				<Label for="username">Usuario</Label>
				<Input id="username" bind:value={formData.username} required />
			</div>
		</div>

		<div>
			<Label for="email">Email</Label>
			<Input id="email" type="email" bind:value={formData.email} required />
		</div>

		<div>
			<Label for="password">
				{isEditMode ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
			</Label>
			<Input
				id="password"
				type="password"
				bind:value={formData.password}
				required={!isEditMode}
				minlength={8}
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<Label for="role">Rol</Label>
				<Select id="role" bind:value={formData.role}>
					{#each ALL_ROLES as role, index (`${role}-${index}`)}
						<option value={role}>{role}</option>
					{/each}
				</Select>
			</div>
			<div class="flex items-end">
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={formData.isActive} />
					<span class="text-sm">Usuario activo</span>
				</label>
			</div>
		</div>

		<div class="flex justify-end gap-2 pt-4">
			<Button color="light" onclick={onClose}>Cancelar</Button>
			<Button type="submit" color="blue" disabled={loading}>
				{#if loading}<Spinner size="4" class="mr-2" />{/if}
				{submitText}
			</Button>
		</div>
	</form>
</Modal>
