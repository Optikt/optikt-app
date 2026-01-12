<script lang="ts">
	import { Button, Spinner } from 'flowbite-svelte';
	import { User, Lock, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateProfileForm } from '$lib/remote/profile.remote';
	import { getErrorMessage } from '$lib/utils';
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
	let formInstanceId = $state(crypto.randomUUID());
	const currentForm = $derived(updateProfileForm.for(formInstanceId));

	function resetForm() {
		fullName = user.fullName;
		email = user.email;
		formInstanceId = crypto.randomUUID();
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
						<Spinner size="4" class="mr-2" />
					{/if}
					<Save class="mr-2 h-4 w-4" />
					Guardar Cambios
				</Button>
			</div>
		</div>
	</form>
</div>

<ChangePasswordModal bind:open={showPasswordModal} onClose={() => {}} />
