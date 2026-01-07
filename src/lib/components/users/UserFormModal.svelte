<script lang="ts">
	import { Modal, Select, Button, Spinner, Checkbox } from 'flowbite-svelte';
	import * as v from 'valibot';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	import { CreateUserSchema, UpdateUserSchema } from '$lib/schemas/users';
	import { FormInput } from '$lib/components/ui';
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
		role: UserRole.VIEWER,
		isActive: true
	});

	// Field-level validation errors
	let fieldErrors = $state<Record<string, string>>({});

	// Reset form when modal opens or user changes
	$effect(() => {
		if (open) {
			fieldErrors = {};
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

	function validateForm(): boolean {
		fieldErrors = {};
		const isEditMode = !!user;

		try {
			if (isEditMode) {
				const dataToValidate: Record<string, unknown> = {
					id: user!.id,
					fullName: formData.fullName,
					username: formData.username,
					email: formData.email,
					role: formData.role,
					isActive: formData.isActive
				};
				if (formData.password) {
					dataToValidate.password = formData.password;
				}
				v.parse(UpdateUserSchema, dataToValidate);
			} else {
				v.parse(CreateUserSchema, {
					fullName: formData.fullName,
					username: formData.username,
					email: formData.email,
					password: formData.password,
					role: formData.role,
					isActive: formData.isActive
				});
			}
			return true;
		} catch (err) {
			if (v.isValiError(err)) {
				for (const issue of err.issues) {
					const path = issue.path?.map((p) => p.key).join('.') || 'general';
					if (!fieldErrors[path]) {
						fieldErrors[path] = issue.message;
					}
				}
			}
			return false;
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

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
	<form onsubmit={handleSubmit} autocomplete="off" class="space-y-4">
		{#if error}
			<div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
		{/if}

		<div class="grid grid-cols-2 gap-4">
			<div>
				<FormInput
					name="fullName"
					label="Nombre Completo"
					autocomplete="off"
					bind:value={formData.fullName}
					error={fieldErrors['fullName']}
				/>
			</div>
			<div>
				<FormInput
					name="username"
					label="Usuario"
					autocomplete="new-password"
					bind:value={formData.username}
					error={fieldErrors['username']}
				/>
			</div>
		</div>

		<div>
			<FormInput
				name="email"
				label="Email"
				type="email"
				autocomplete="off"
				bind:value={formData.email}
				error={fieldErrors['email']}
			/>
		</div>

		<div>
			<FormInput
				name="password"
				label={isEditMode ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
				type="password"
				autocomplete="new-password"
				bind:value={formData.password}
				error={fieldErrors['password']}
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="role" class="mb-2 block text-sm font-medium text-gray-900">Rol</label>
				<Select id="role" name="role" bind:value={formData.role}>
					{#each ALL_ROLES as role, index (`${role}-${index}`)}
						<option value={role}>{role}</option>
					{/each}
				</Select>
			</div>
			<div class="flex items-end">
				<Checkbox bind:checked={formData.isActive}>Usuario activo</Checkbox>
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
