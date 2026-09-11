<script lang="ts">
	import { Check, SquarePen, User, X } from '@lucide/svelte';
	import { FormInput, FormTextarea, FormDatepicker, IdInput } from '$lib/components/ui';
	import { updateCustomerForm } from '$lib/remote/customers.remote';
	import { getErrorMessage, scrollToFirstError, toastUnboundErrors } from '$lib/utils';
	import { formatDate } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { Customer } from '$lib/server/db/schema';
	import type { CustomerEditData } from './customerDetail';

	interface Props {
		customer: Customer;
		isEditing: boolean;
		canAct: boolean;
		editData: CustomerEditData;
		editLoading: boolean;
		updateForm: ReturnType<typeof updateCustomerForm.for>;
		today: Date;
		onStartEdit: () => void;
		onCancelEdit: () => void;
		onSaved: () => void;
	}

	let {
		customer,
		isEditing,
		canAct,
		editData = $bindable(),
		editLoading = $bindable(),
		updateForm,
		today,
		onStartEdit,
		onCancelEdit,
		onSaved
	}: Props = $props();
</script>

{#if isEditing}
	<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
		<div class="mb-5 flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<User class="h-5 w-5 text-brand-blue" />
				<h2 class="font-heading text-base font-bold tracking-wider text-on-surface uppercase">
					Información Personal
				</h2>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={onCancelEdit}
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
				>
					<X class="h-4 w-4" />
					Cancelar
				</button>
				<button
					type="submit"
					form="edit-customer-form"
					disabled={editLoading}
					class="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:shadow-md disabled:opacity-60"
				>
					{#if editLoading}
						<span
							class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
						></span>
					{:else}
						<Check class="h-4 w-4" />
					{/if}
					Guardar
				</button>
			</div>
		</div>

		<form
			id="edit-customer-form"
			{...updateForm.enhance(async ({ submit }) => {
				editLoading = true;
				try {
					await submit();

					const allIssues = updateForm.fields.allIssues?.() ?? [];
					if (allIssues.length > 0) {
						scrollToFirstError();
						toastUnboundErrors(allIssues);
						return;
					}

					toast.success('Cliente actualizado exitosamente');
					await invalidateAll();
					onSaved();
				} catch (e) {
					toast.error(getErrorMessage(e, 'Error actualizando cliente'));
				} finally {
					editLoading = false;
				}
			})}
		>
			<input type="hidden" name="id" value={customer.id} />
			<div class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="firstName"
						label="Nombre"
						required
						bind:value={editData.firstName}
						error={updateForm.fields.firstName?.issues()}
					/>
					<FormInput
						name="lastName"
						label="Apellido"
						required
						bind:value={editData.lastName}
						error={updateForm.fields.lastName?.issues()}
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<IdInput
						name="idNumber"
						label="Cédula"
						bind:value={editData.idNumber}
						error={updateForm.fields.idNumber?.issues()}
					/>
					<FormDatepicker
						name="birthDate"
						label="Fecha de Nacimiento"
						required
						bind:value={editData.birthDate}
						availableTo={today}
						error={updateForm.fields.birthDate?.issues()}
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="primaryPhone"
						label="Teléfono"
						type="tel"
						required
						placeholder="+58 412-1234567"
						bind:value={editData.primaryPhone}
						error={updateForm.fields.primaryPhone?.issues()}
					/>
					<FormInput
						name="email"
						label="Email"
						type="email"
						placeholder="cliente@email.com"
						bind:value={editData.email}
						error={updateForm.fields.email?.issues()}
					/>
				</div>
				<FormInput
					name="address"
					label="Dirección"
					placeholder="Av. Principal, Centro..."
					bind:value={editData.address}
				/>
				<FormTextarea
					name="notes"
					label="Notas"
					placeholder="Observaciones..."
					rows={2}
					bind:value={editData.notes}
				/>
			</div>
		</form>
	</div>
{:else}
	<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
		<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-2.5">
				<User class="h-5 w-5 text-brand-blue" />
				<h2 class="font-heading text-base font-bold tracking-wider text-on-surface uppercase">
					Información Personal
				</h2>
			</div>
			{#if canAct}
				<button
					type="button"
					onclick={onStartEdit}
					class="inline-flex items-center gap-1.5 self-start rounded-lg border border-outline-variant/40 px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-brand-blue hover:text-brand-blue sm:self-auto"
				>
					<SquarePen class="h-4 w-4" />
					Editar Perfil
				</button>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-y-5 sm:grid-cols-2">
			<div>
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Nombre</span
				>
				<p class="mt-0.5 text-sm font-medium text-on-surface">
					{customer.firstName ?? '-'}
				</p>
			</div>
			<div>
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Apellido</span
				>
				<p class="mt-0.5 text-sm font-medium text-on-surface">
					{customer.lastName ?? '-'}
				</p>
			</div>
			<div>
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Cédula</span
				>
				<p class="mt-0.5 font-mono text-sm text-on-surface">
					{customer.idNumber ?? '-'}
				</p>
			</div>
			<div>
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Fecha de Nacimiento</span
				>
				<p class="mt-0.5 text-sm text-on-surface">
					{customer.birthDate ? formatDate(customer.birthDate) : '-'}
				</p>
			</div>
			<div>
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Teléfono</span
				>
				<p class="mt-0.5 text-sm text-on-surface">
					{customer.primaryPhone ?? '-'}
				</p>
			</div>
			<div>
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Correo</span
				>
				<p class="mt-0.5 text-sm text-on-surface">
					{customer.email ?? '-'}
				</p>
			</div>
			<div class="sm:col-span-2">
				<span class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
					>Dirección</span
				>
				<p class="mt-0.5 text-sm text-on-surface">
					{customer.address ?? '-'}
				</p>
			</div>
			{#if customer.notes}
				<div class="sm:col-span-2">
					<span
						class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
						>Notas</span
					>
					<p class="mt-0.5 text-sm whitespace-pre-wrap text-on-surface-variant">
						{customer.notes}
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
