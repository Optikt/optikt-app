<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { Lock } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { changePasswordForm } from '$lib/remote/profile.remote';
	import { getErrorMessage } from '$lib/utils';
	import { PasswordField } from '$lib/components/ui';
	import { untrack } from 'svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), onClose }: Props = $props();

	// Form reset pattern for modals
	let formInstanceId = $state(crypto.randomUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = crypto.randomUUID();
			});
			// Blur any focused element to prevent browser password dropdown
			setTimeout(() => {
				(document.activeElement as HTMLElement)?.blur();
			}, 50);
		}
	});

	const currentForm = $derived(changePasswordForm.for(formInstanceId));

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);

	function resetForm() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
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
		<PasswordField
			label="Contraseña Actual"
			name="currentPassword"
			bind:value={currentPassword}
			autocomplete="new-password"
			error={currentForm.fields.currentPassword?.issues()}
		/>

		<PasswordField
			label="Nueva Contraseña"
			name="newPassword"
			bind:value={newPassword}
			autocomplete="new-password"
			error={currentForm.fields.newPassword?.issues()}
		/>

		<PasswordField
			label="Confirmar Contraseña"
			name="confirmPassword"
			bind:value={confirmPassword}
			autocomplete="new-password"
			error={currentForm.fields.confirmPassword?.issues()}
		/>

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
