<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Building2, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateSettingsForm } from '$lib/remote/settings.remote';
	import { getErrorMessage, toastUnboundErrors } from '$lib/utils';
	import { FormInput, FormTextarea, RifInput } from '$lib/components/ui';
	import type { Settings } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { generateUUID } from '$lib/utils/generateUUID';

	interface Props {
		settings: Settings;
		onUpdate?: () => void;
	}

	let { settings, onUpdate }: Props = $props();

	// Form state - use untrack because settings is loaded once and won't change reactively
	let businessName = $state(untrack(() => settings.businessName ?? ''));
	let businessRif = $state(untrack(() => settings.businessRif ?? ''));
	let businessPhone = $state(untrack(() => settings.businessPhone ?? ''));
	let businessEmail = $state(untrack(() => settings.businessEmail ?? ''));
	let businessAddress = $state(untrack(() => settings.businessAddress ?? ''));
	let businessWebsite = $state(untrack(() => settings.businessWebsite ?? ''));
	let defaultTaxRate = $state(untrack(() => settings.defaultTaxRate?.toString() ?? '16'));
	let loading = $state(false);

	// Form instance
	let formInstanceId = $state(generateUUID());
	const currentForm = $derived(updateSettingsForm.for(formInstanceId));

	function resetForm() {
		businessName = settings.businessName ?? '';
		businessRif = settings.businessRif ?? '';
		businessPhone = settings.businessPhone ?? '';
		businessEmail = settings.businessEmail ?? '';
		businessAddress = settings.businessAddress ?? '';
		businessWebsite = settings.businessWebsite ?? '';
		defaultTaxRate = settings.defaultTaxRate?.toString() ?? '16';
		formInstanceId = generateUUID();
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
				} else {
					toastUnboundErrors(allIssues);
				}
			} catch (e) {
				toast.error(getErrorMessage(e, 'Error al guardar configuración'));
			} finally {
				loading = false;
			}
		})}
		class="space-y-4"
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormInput
				label="Nombre del Negocio"
				name="businessName"
				bind:value={businessName}
				placeholder="Óptica Central"
				error={currentForm.fields.businessName?.issues()}
			/>

			<RifInput
				label="RIF del Negocio"
				name="businessRif"
				bind:value={businessRif}
				error={currentForm.fields.businessRif?.issues()}
			/>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<FormInput
				label="Teléfono"
				type="tel"
				name="businessPhone"
				bind:value={businessPhone}
				placeholder="+58 412-1234567"
			/>

			<FormInput
				label="Email"
				type="email"
				name="businessEmail"
				bind:value={businessEmail}
				placeholder="contacto@optica.com"
				error={currentForm.fields.businessEmail?.issues()}
			/>
		</div>

		<FormInput
			label="Sitio Web"
			type="url"
			name="businessWebsite"
			bind:value={businessWebsite}
			placeholder="https://www.optica.com"
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<FormInput
				label="Tasa de Impuesto por Defecto (%)"
				type="number"
				name="defaultTaxRate"
				bind:value={defaultTaxRate}
				placeholder="16"
				error={currentForm.fields.defaultTaxRate?.issues()}
			/>
			<div></div>
		</div>

		<FormTextarea
			label="Dirección"
			name="businessAddress"
			bind:value={businessAddress}
			placeholder="Av. Principal, Centro Comercial..."
			rows={2}
		/>

		<div class="flex justify-end gap-2 pt-4">
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
				Guardar Configuración
			</Button>
		</div>
	</form>
</div>
