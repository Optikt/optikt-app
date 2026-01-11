<script lang="ts">
	import { Modal, Button, Label, Input, Helper, Spinner } from 'flowbite-svelte';
	import { Eye, EyeOff, Lock } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { changePasswordForm } from '$lib/remote/profile.remote';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), onClose }: Props = $props();

	// Form state
	let formInstanceId = $state(crypto.randomUUID());
	$effect(() => {
		if (open) {
			formInstanceId = crypto.randomUUID();
		}
	});

	const currentForm = $derived(changePasswordForm.for(formInstanceId));

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let loading = $state(false);

	function resetForm() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		showCurrentPassword = false;
		showNewPassword = false;
	}

	function handleClose() {
		resetForm();
		open = false;
		onClose();
	}
</script>

<Modal bind:open size="md" title="Cambiar Contraseña" outsideclose onclose={handleClose}>
	<form
		{...currentForm.enhance(async ({ submit }) => {
			loading = true;
			try {
				await submit();
				const allIssues = currentForm.fields.allIssues?.() ?? [];
				if (allIssues.length === 0) {
					toast.success('Contraseña actualizada exitosamente');
					handleClose();
				}
			} catch (e) {
				console.error(e);
				toast.error(getErrorMessage(e, 'Error al cambiar contraseña'));
			} finally {
				loading = false;
			}
		})}
		class="space-y-4"
	>
		<!-- Current Password -->
		<div>
			<Label for="currentPassword" class="mb-2">Contraseña Actual</Label>
			<div class="relative">
				<Input
					type={showCurrentPassword ? 'text' : 'password'}
					id="currentPassword"
					name="currentPassword"
					bind:value={currentPassword}
					placeholder="••••••••"
					color={currentForm.fields.currentPassword?.issues()?.length ? 'red' : undefined}
				/>
				<button
					type="button"
					onclick={() => (showCurrentPassword = !showCurrentPassword)}
					class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
				>
					{#if showCurrentPassword}
						<EyeOff class="h-4 w-4" />
					{:else}
						<Eye class="h-4 w-4" />
					{/if}
				</button>
			</div>
			{#if currentForm.fields.currentPassword?.issues()?.length}
				<Helper color="red" class="mt-1">
					{currentForm.fields.currentPassword?.issues()?.[0]?.message}
				</Helper>
			{/if}
		</div>

		<!-- New Password -->
		<div>
			<Label for="newPassword" class="mb-2">Nueva Contraseña</Label>
			<div class="relative">
				<Input
					type={showNewPassword ? 'text' : 'password'}
					id="newPassword"
					name="newPassword"
					bind:value={newPassword}
					placeholder="••••••••"
					color={currentForm.fields.newPassword?.issues()?.length ? 'red' : undefined}
				/>
				<button
					type="button"
					onclick={() => (showNewPassword = !showNewPassword)}
					class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
				>
					{#if showNewPassword}
						<EyeOff class="h-4 w-4" />
					{:else}
						<Eye class="h-4 w-4" />
					{/if}
				</button>
			</div>
			{#if currentForm.fields.newPassword?.issues()?.length}
				<Helper color="red" class="mt-1">
					{currentForm.fields.newPassword?.issues()?.[0]?.message}
				</Helper>
			{/if}
		</div>

		<!-- Confirm Password -->
		<div>
			<Label for="confirmPassword" class="mb-2">Confirmar Contraseña</Label>
			<Input
				type="password"
				id="confirmPassword"
				name="confirmPassword"
				bind:value={confirmPassword}
				placeholder="••••••••"
				color={currentForm.fields.confirmPassword?.issues()?.length ? 'red' : undefined}
			/>
			{#if currentForm.fields.confirmPassword?.issues()?.length}
				<Helper color="red" class="mt-1">
					{currentForm.fields.confirmPassword?.issues()?.[0]?.message}
				</Helper>
			{/if}
		</div>

		<div class="flex justify-end gap-3 pt-4">
			<Button color="alternative" onclick={handleClose}>Cancelar</Button>
			<Button type="submit" color="primary" disabled={loading}>
				{#if loading}
					<Spinner size="4" class="mr-2" />
				{/if}
				<Lock class="mr-2 h-4 w-4" />
				Cambiar Contraseña
			</Button>
		</div>
	</form>
</Modal>
