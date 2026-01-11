<script lang="ts">
	import { Button, Label, Input, Helper, Spinner, Textarea } from 'flowbite-svelte';
	import { Building2, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateSettingsForm } from '$lib/remote/settings.remote';
	import { getErrorMessage } from '$lib/utils';
	import { RifInput } from '$lib/components/ui';
	import type { Settings } from '$lib/server/db/schema';

	interface Props {
		settings: Settings | null;
		onUpdate?: () => void;
	}

	let { settings, onUpdate }: Props = $props();

	import { untrack } from 'svelte';

	// Form state - use untrack because settings is loaded once and won't change reactively
	let businessName = $state(untrack(() => settings?.businessName ?? ''));
	let businessRif = $state(untrack(() => settings?.businessRif ?? ''));
	let businessPhone = $state(untrack(() => settings?.businessPhone ?? ''));
	let businessEmail = $state(untrack(() => settings?.businessEmail ?? ''));
	let businessAddress = $state(untrack(() => settings?.businessAddress ?? ''));
	let businessWebsite = $state(untrack(() => settings?.businessWebsite ?? ''));
	let loading = $state(false);

	// Form instance
	let formInstanceId = $state(crypto.randomUUID());
	const currentForm = $derived(updateSettingsForm.for(formInstanceId));

	function resetForm() {
		businessName = settings?.businessName ?? '';
		businessRif = settings?.businessRif ?? '';
		businessPhone = settings?.businessPhone ?? '';
		businessEmail = settings?.businessEmail ?? '';
		businessAddress = settings?.businessAddress ?? '';
		businessWebsite = settings?.businessWebsite ?? '';
		formInstanceId = crypto.randomUUID();
	}
</script>

<div class="glass-card p-6">
	<div class="mb-6 flex items-center gap-3">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
			<Building2 class="h-6 w-6 text-blue-600" />
		</div>
		<div>
			<h2 class="text-lg font-semibold text-slate-800">Datos del Negocio</h2>
			<p class="text-sm text-slate-500">Configuración de la empresa (solo administradores)</p>
		</div>
	</div>

	<form
		{...currentForm.enhance(async ({ submit }) => {
			loading = true;
			try {
				await submit();
				const allIssues = currentForm.fields.allIssues?.() ?? [];
				if (allIssues.length === 0) {
					toast.success('Configuración guardada exitosamente');
					onUpdate?.();
				}
			} catch (e) {
				console.error(e);
				toast.error(getErrorMessage(e, 'Error al guardar configuración'));
			} finally {
				loading = false;
			}
		})}
		class="space-y-4"
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<!-- Business Name -->
			<div>
				<Label for="businessName" class="mb-2">Nombre del Negocio</Label>
				<Input
					id="businessName"
					name="businessName"
					bind:value={businessName}
					placeholder="Óptica Central"
					color={currentForm.fields.businessName?.issues()?.length ? 'red' : undefined}
				/>
				{#if currentForm.fields.businessName?.issues()?.length}
					<Helper color="red" class="mt-1">
						{currentForm.fields.businessName?.issues()?.[0]?.message}
					</Helper>
				{/if}
			</div>

			<!-- Business RIF -->
			<RifInput
				label="RIF del Negocio"
				name="businessRif"
				bind:value={businessRif}
				error={currentForm.fields.businessRif?.issues()}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<!-- Phone -->
			<div>
				<Label for="businessPhone" class="mb-2">Teléfono</Label>
				<Input
					type="tel"
					id="businessPhone"
					name="businessPhone"
					bind:value={businessPhone}
					placeholder="+58 412-1234567"
				/>
			</div>

			<!-- Email -->
			<div>
				<Label for="businessEmail" class="mb-2">Email</Label>
				<Input
					type="email"
					id="businessEmail"
					name="businessEmail"
					bind:value={businessEmail}
					placeholder="contacto@optica.com"
					color={currentForm.fields.businessEmail?.issues()?.length ? 'red' : undefined}
				/>
				{#if currentForm.fields.businessEmail?.issues()?.length}
					<Helper color="red" class="mt-1">
						{currentForm.fields.businessEmail?.issues()?.[0]?.message}
					</Helper>
				{/if}
			</div>
		</div>

		<!-- Website -->
		<div>
			<Label for="businessWebsite" class="mb-2">Sitio Web</Label>
			<Input
				type="url"
				id="businessWebsite"
				name="businessWebsite"
				bind:value={businessWebsite}
				placeholder="https://www.optica.com"
			/>
		</div>

		<!-- Address -->
		<div>
			<Label for="businessAddress" class="mb-2">Dirección</Label>
			<Textarea
				id="businessAddress"
				name="businessAddress"
				bind:value={businessAddress}
				placeholder="Av. Principal, Centro Comercial..."
				rows={2}
			/>
		</div>

		<div class="flex justify-end gap-2 pt-4">
			<Button color="alternative" onclick={resetForm}>Restablecer</Button>
			<Button type="submit" color="primary" disabled={loading}>
				{#if loading}
					<Spinner size="4" class="mr-2" />
				{/if}
				<Save class="mr-2 h-4 w-4" />
				Guardar Configuración
			</Button>
		</div>
	</form>
</div>
