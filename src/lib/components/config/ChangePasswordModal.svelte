<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Lock } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { changePasswordForm } from '$lib/remote/profile.remote';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { PasswordField } from '$lib/components/ui';
	import { untrack } from 'svelte';
	import { generateUUID } from '$lib/utils/generateUUID';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), onClose }: Props = $props();

	// Form reset pattern for modals
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				formInstanceId = generateUUID();
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

<Dialog.Root
	bind:open
	onOpenChangeComplete={(o) => {
		if (!o) handleClose();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Cambiar Contraseña</Dialog.Title>
		</Dialog.Header>
		<form
			{...currentForm.enhance(async ({ submit }) => {
				loading = true;
				try {
					await submit();
					const allIssues = currentForm.fields.allIssues?.() ?? [];
					if (allIssues.length === 0) {
						toast.success('Contraseña actualizada exitosamente');
						handleClose();
					} else {
						toastUnboundErrors(allIssues);
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

			<Dialog.Footer class="flex justify-end gap-3 pt-4">
				<Button variant="outline" onclick={handleClose}>Cancelar</Button>
				<Button type="submit" disabled={loading}>
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
					<Lock class="mr-2 h-4 w-4" />
					Cambiar Contraseña
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
