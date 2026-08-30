<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	import { createUserForm, updateUserForm } from '$lib/remote/users.remote';
	import { FormInput, PasswordField } from '$lib/components/ui';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
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
		role: UserRole.VIEWER as UserRole
	});

	// Local loading state
	let isSubmitting = $state(false);

	// Form instance ID - changes on each modal open to create fresh form instance
	// This clears validation issues by creating a new form instance via .for(id)
	let formInstanceId = $state(generateUUID());

	// Reset form when modal opens or user changes
	$effect(() => {
		if (open) {
			// Generate new form ID to create a fresh form instance (untracked to avoid loop)
			untrack(() => {
				formInstanceId = generateUUID();
			});

			if (user) {
				formData = {
					fullName: user.fullName,
					username: user.username,
					email: user.email,
					password: '',
					role: user.role
				};
			} else {
				formData = {
					fullName: '',
					username: '',
					email: '',
					password: '',
					role: UserRole.VIEWER
				};
			}
		}
	});

	const isEditMode = $derived(!!user);
	const title = $derived(isEditMode ? 'Editar Usuario' : 'Agregar Usuario');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Usuario');

	// Create fresh form instances using .for(id) - changes when formInstanceId changes
	const currentCreateForm = $derived(createUserForm.for(formInstanceId));
	const currentUpdateForm = $derived(updateUserForm.for(`${user?.id ?? 'new'}-${formInstanceId}`));

	// Shared form content
	function handleCreateResult(formEl: HTMLFormElement) {
		// Check for validation issues first
		const allIssues = currentCreateForm.fields.allIssues?.();
		if (allIssues && allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return;
		}

		const result = currentCreateForm.result as CreateUserResult | undefined;

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
		// Check for validation issues first
		const allIssues = currentUpdateForm.fields.allIssues?.();
		if (allIssues && allIssues.length > 0) {
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Usuario actualizado');
		formEl.reset();
		open = false;
		onSuccess?.();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		{#if isEditMode && user}
			<!-- UPDATE FORM -->
			<form
				{...currentUpdateForm.enhance(async ({ element: formEl, submit }) => {
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
							error={currentUpdateForm.fields.fullName.issues()}
						/>
					</div>
					<div>
						<FormInput
							name="username"
							label="Usuario"
							autocomplete="new-password"
							bind:value={formData.username}
							error={currentUpdateForm.fields.username.issues()}
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
						error={currentUpdateForm.fields.email.issues()}
					/>
				</div>

				<div>
					<PasswordField
						name="password"
						label="Nueva Contraseña (dejar vacío para mantener)"
						autocomplete="new-password"
						bind:value={formData.password}
						error={currentUpdateForm.fields.password.issues()}
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<Label for="role" class="mb-2">Rol</Label>
						<select
							id="role"
							name="role"
							bind:value={formData.role}
							class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none"
						>
							{#each ALL_ROLES as role, index (`${role}-${index}`)}
								<option value={role}>{role}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<Button variant="outline" onclick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={isSubmitting}>
						{#if isSubmitting}<svg
								class="mx-auto h-5 w-5 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
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
						{submitText}
					</Button>
				</div>
			</form>
		{:else}
			<!-- CREATE FORM -->
			<form
				{...currentCreateForm.enhance(async ({ element: formEl, submit }) => {
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
							error={currentCreateForm.fields.fullName.issues()}
						/>
					</div>
					<div>
						<FormInput
							name="username"
							label="Usuario"
							autocomplete="new-password"
							bind:value={formData.username}
							error={currentCreateForm.fields.username.issues()}
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
						error={currentCreateForm.fields.email.issues()}
					/>
				</div>

				<div>
					<PasswordField
						name="password"
						label="Contraseña"
						autocomplete="new-password"
						bind:value={formData.password}
						error={currentCreateForm.fields.password.issues()}
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<Label for="role" class="mb-2">Rol</Label>
						<select
							id="role"
							name="role"
							bind:value={formData.role}
							class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none"
						>
							{#each ALL_ROLES as role, index (`${role}-${index}`)}
								<option value={role}>{role}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex justify-end gap-2 pt-4">
					<Button variant="outline" onclick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={isSubmitting}>
						{#if isSubmitting}<svg
								class="mx-auto h-5 w-5 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
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
						{submitText}
					</Button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
