<script lang="ts">
	import { Modal, Select, Button, Spinner, Checkbox, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	// import { CreateUserSchema, UpdateUserSchema } from '$lib/schemas/users';
	import { createUserForm, updateUserForm } from '$lib/remote/users.remote';
	import { FormInput } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import type { UserListItem, CreateUserResult } from '$lib/types/users';

	interface Props {
		open: boolean;
		user?: UserListItem | null; // null = create mode, user = edit mode
		onSuccess?: () => void;
		onReactivate?: (candidate: UserListItem, formData: FormData) => void;
		onClose: () => void;
	}

	let { open = $bindable(), user = null, onSuccess, onReactivate, onClose }: Props = $props();

	// Local form data for controlled inputs
	let formData = $state({
		fullName: '',
		username: '',
		email: '',
		password: '',
		role: UserRole.VIEWER as UserRole,
		isActive: true
	});

	// Local loading state
	let isSubmitting = $state(false);

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

	const isEditMode = $derived(!!user);
	const title = $derived(isEditMode ? 'Editar Usuario' : 'Agregar Usuario');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Usuario');

	// Shared form content
	function handleCreateResult(formEl: HTMLFormElement) {
		const result = createUserForm.result as CreateUserResult | undefined;

		if (result && result.success === false && result.reactivationCandidate) {
			// Reactivation candidate found - pass to parent
			const fd = new FormData(formEl);
			onReactivate?.(result.reactivationCandidate, fd);
		} else {
			toast.success('Usuario creado');
			formEl.reset();
			open = false;
			onSuccess?.();
		}
	}

	function handleUpdateResult(formEl: HTMLFormElement) {
		toast.success('Usuario actualizado');
		formEl.reset();
		open = false;
		onSuccess?.();
	}
</script>

<Modal bind:open size="md" {title}>
	{#if isEditMode && user}
		<!-- UPDATE FORM -->
		<form
			{...updateUserForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (e) {
					toast.error(getErrorMessage(e, 'Error actualizando usuario'));
				} finally {
					isSubmitting = false;
				}
			})}
			autocomplete="off"
			class="space-y-4"
		>
			<input type="hidden" name="id" value={user.id} />

			<div class="grid grid-cols-2 gap-4">
				<div>
					<FormInput
						name="fullName"
						label="Nombre Completo"
						autocomplete="off"
						bind:value={formData.fullName}
						issues={updateUserForm.fields.fullName.issues()}
					/>
				</div>
				<div>
					<FormInput
						name="username"
						label="Usuario"
						autocomplete="new-password"
						bind:value={formData.username}
						issues={updateUserForm.fields.username.issues()}
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
					issues={updateUserForm.fields.email.issues()}
				/>
			</div>

			<div>
				<FormInput
					name="password"
					label="Nueva Contraseña (dejar vacío para mantener)"
					type="password"
					autocomplete="new-password"
					bind:value={formData.password}
					issues={updateUserForm.fields.password.issues()}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="role" class="mb-2">Rol</Label>
					<Select id="role" name="role" bind:value={formData.role}>
						{#each ALL_ROLES as role, index (`${role}-${index}`)}
							<option value={role}>{role}</option>
						{/each}
					</Select>
				</div>
				<div class="flex items-end">
					<Checkbox name="b:isActive" bind:checked={formData.isActive}>Usuario activo</Checkbox>
				</div>
			</div>

			<div class="flex justify-end gap-2 pt-4">
				<Button color="light" onclick={onClose}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{:else}
		<!-- CREATE FORM -->
		<form
			{...createUserForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleCreateResult(formEl);
				} catch (e) {
					toast.error(getErrorMessage(e, 'Error creando usuario'));
				} finally {
					isSubmitting = false;
				}
			})}
			autocomplete="off"
			class="space-y-4"
		>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<FormInput
						name="fullName"
						label="Nombre Completo"
						autocomplete="off"
						bind:value={formData.fullName}
						issues={createUserForm.fields.fullName.issues()}
					/>
				</div>
				<div>
					<FormInput
						name="username"
						label="Usuario"
						autocomplete="new-password"
						bind:value={formData.username}
						issues={createUserForm.fields.username.issues()}
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
					issues={createUserForm.fields.email.issues()}
				/>
			</div>

			<div>
				<FormInput
					name="password"
					label="Contraseña"
					type="password"
					autocomplete="new-password"
					bind:value={formData.password}
					issues={createUserForm.fields.password.issues()}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="role" class="mb-2">Rol</Label>
					<Select id="role" name="role" bind:value={formData.role}>
						{#each ALL_ROLES as role, index (`${role}-${index}`)}
							<option value={role}>{role}</option>
						{/each}
					</Select>
				</div>
				<div class="flex items-end">
					<Checkbox name="b:isActive" bind:checked={formData.isActive}>Usuario activo</Checkbox>
				</div>
			</div>

			<div class="flex justify-end gap-2 pt-4">
				<Button color="light" onclick={onClose}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{/if}
</Modal>
