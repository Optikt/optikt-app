<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { User, Lock, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateProfileForm } from '$lib/remote/profile.remote';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { FormInput } from '$lib/components/ui';
	import ChangePasswordModal from './ChangePasswordModal.svelte';
	import { untrack } from 'svelte';
	import type { UserListItem } from '$lib/types';

	interface Props {
		user: Omit<UserListItem, 'createdAt'>;
		onUpdate?: () => void;
	}

	let { user, onUpdate }: Props = $props();

	// Destructure with untrack since user is loaded once and won't change reactively
	const { fullName: initialFullName, email: initialEmail, username } = untrack(() => user);

	// Form state
	let fullName = $state(initialFullName);
	let email = $state(initialEmail);
	let loading = $state(false);
	let showPasswordModal = $state(false);

	// Form instance
	let formInstanceId = $state(generateUUID());
	const currentForm = $derived(updateProfileForm.for(formInstanceId));

	function resetForm() {
		fullName = user.fullName;
		email = user.email;
		formInstanceId = generateUUID();
	}
</script>

<div class="glass-card p-6">
	<div class="mb-6 flex items-center gap-3">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
			<User class="h-6 w-6 text-primary-600" />
		</div>
		<div>
			<h2 class="text-lg font-semibold text-slate-800">Mi Perfil</h2>
			<p class="text-sm text-slate-500">Actualiza tu información personal</p>
		</div>
	</div>

	<form
		{...currentForm.enhance(async ({ submit }) => {
			loading = true;
			try {
				await submit();
				const allIssues = currentForm.fields.allIssues?.() ?? [];
				if (allIssues.length === 0) {
					toast.success('Perfil actualizado exitosamente');
					onUpdate?.();
				} else {
					toastUnboundErrors(allIssues);
				}
			} catch (e) {
				console.error(e);
				toast.error(getErrorMessage(e, 'Error al actualizar perfil'));
			} finally {
				loading = false;
			}
		})}
		class="space-y-4"
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormInput
				label="Nombre Completo"
				name="fullName"
				bind:value={fullName}
				placeholder="Tu nombre"
				error={currentForm.fields.fullName?.issues()}
			/>

			<FormInput
				label="Email"
				type="email"
				name="email"
				bind:value={email}
				placeholder="tu@email.com"
				error={currentForm.fields.email?.issues()}
			/>
			<div>
				<FormInput
					title="El nombre de usuario no se puede cambiar"
					label="Usuario"
					name="username"
					value={username}
					disabled
					class="bg-slate-50"
				/>
				<p class="mt-2 text-xs text-slate-400">El nombre de usuario no se puede cambiar</p>
			</div>
		</div>

		<!-- Username (read-only) -->
		<div class="flex items-center justify-between pt-4">
			<Button color="light" onclick={() => (showPasswordModal = true)}>
				<Lock class="mr-2 h-4 w-4" />
				Cambiar Contraseña
			</Button>

			<div class="flex gap-2">
				<Button color="alternative" onclick={resetForm}>Restablecer</Button>
				<Button type="submit" color="primary" disabled={loading}>
					{#if loading}
						<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
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
						>
					{/if}
					<Save class="mr-2 h-4 w-4" />
					Guardar Cambios
				</Button>
			</div>
		</div>
	</form>
</div>

<ChangePasswordModal bind:open={showPasswordModal} onClose={() => {}} />
