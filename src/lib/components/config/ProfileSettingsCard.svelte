<script lang="ts">
	import { Button, Label, Input, Helper, Spinner } from 'flowbite-svelte';
	import { User, Lock, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateProfileForm } from '$lib/remote/profile.remote';
	import { getErrorMessage } from '$lib/utils';
	import ChangePasswordModal from './ChangePasswordModal.svelte';
	import type { UserRole } from '$lib/shared/enums';

	interface UserInfo {
		id: string;
		email: string;
		username: string;
		fullName: string;
		role: UserRole;
		isActive: boolean;
		isSuperuser: boolean;
	}

	interface Props {
		user: UserInfo;
		onUpdate?: () => void;
	}

	let { user, onUpdate }: Props = $props();

	import { untrack } from 'svelte';

	// Form state - use untrack because user is loaded once and won't change reactively
	let fullName = $state(untrack(() => user.fullName));
	let email = $state(untrack(() => user.email));
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
			<!-- Name -->
			<div>
				<Label for="fullName" class="mb-2">Nombre Completo</Label>
				<Input
					id="fullName"
					name="fullName"
					bind:value={fullName}
					placeholder="Tu nombre"
					color={currentForm.fields.fullName?.issues()?.length ? 'red' : undefined}
				/>
				{#if currentForm.fields.fullName?.issues()?.length}
					<Helper color="red" class="mt-1">
						{currentForm.fields.fullName?.issues()?.[0]?.message}
					</Helper>
				{/if}
			</div>

			<!-- Email -->
			<div>
				<Label for="email" class="mb-2">Email</Label>
				<Input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					placeholder="tu@email.com"
					color={currentForm.fields.email?.issues()?.length ? 'red' : undefined}
				/>
				{#if currentForm.fields.email?.issues()?.length}
					<Helper color="red" class="mt-1"
						>{currentForm.fields.email?.issues()?.[0]?.message}</Helper
					>
				{/if}
			</div>
		</div>

		<!-- Username (read-only) -->
		<div>
			<Label for="username" class="mb-2">Usuario</Label>
			<Input id="username" value={user.username} disabled class="bg-slate-50" />
			<p class="mt-1 text-xs text-slate-400">El nombre de usuario no se puede cambiar</p>
		</div>

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
