<script lang="ts">
	import { Input, Label, Button, Helper, Spinner, Select, Textarea } from 'flowbite-svelte';
	import { Search, UserCheck, UserPlus, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { lookupCustomer } from '$lib/remote/sales.remote';
	import { getErrorMessage, ID_DOC_PREFIXES, type IdDocPrefix } from '$lib/utils';
	import type { Customer } from '$lib/server/db/schema';

	interface Props {
		/** Resolved customer ID (either found or will be created) */
		customerId: string;
		/** Inline new customer data when creating */
		newCustomer: {
			firstName: string;
			lastName: string;
			idNumber: string;
			primaryPhone: string;
			email: string;
			address: string;
			notes: string;
		} | null;
		/** The full found customer object (for display in other steps) */
		selectedCustomer: Customer | null;
		/** Callback when customer selection changes */
		onchange?: () => void;
	}

	let {
		customerId = $bindable(),
		newCustomer = $bindable(),
		selectedCustomer = $bindable(),
		onchange
	}: Props = $props();

	// Lookup state
	let docType = $state<IdDocPrefix>('V');
	let idDigits = $state('');
	let searching = $state(false);
	let foundCustomer = $state<Customer | null>(null);
	let mode = $state<'idle' | 'found' | 'create'>('idle');

	// Inline creation fields
	let firstName = $state('');
	let lastName = $state('');
	let primaryPhone = $state('');
	let email = $state('');
	let address = $state('');
	let customerNotes = $state('');

	/** Build the full normalized idNumber from prefix + digits */
	function buildIdNumber(): string {
		const digits = idDigits.replace(/\D/g, '');
		if (!digits) return '';
		return `${docType}-${digits}`;
	}

	/** Handle digit input — only allow numbers, max 10 digits */
	function handleDigitsInput(e: Event) {
		const input = e.target as HTMLInputElement;
		idDigits = input.value.replace(/\D/g, '').slice(0, 10);
	}

	async function handleSearch() {
		const fullId = buildIdNumber();
		if (!fullId) return;

		searching = true;
		try {
			const result = await lookupCustomer({ idNumber: fullId });

			if (result.customer) {
				foundCustomer = result.customer;
				customerId = result.customer.id;
				newCustomer = null;
				selectedCustomer = result.customer;
				mode = 'found';
			} else {
				foundCustomer = null;
				customerId = '';
				mode = 'create';
				newCustomer = {
					firstName: '',
					lastName: '',
					idNumber: fullId,
					primaryPhone: '',
					email: '',
					address: '',
					notes: ''
				};
			}
			onchange?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error buscando cliente'));
		} finally {
			searching = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSearch();
		}
	}

	function reset() {
		docType = 'V';
		idDigits = '';
		foundCustomer = null;
		mode = 'idle';
		customerId = '';
		newCustomer = null;
		selectedCustomer = null;
		firstName = '';
		lastName = '';
		primaryPhone = '';
		email = '';
		address = '';
		customerNotes = '';
		onchange?.();
	}

	function syncNewCustomer() {
		if (mode === 'create') {
			newCustomer = {
				firstName,
				lastName,
				idNumber: buildIdNumber(),
				primaryPhone,
				email,
				address,
				notes: customerNotes
			};
		}
	}
</script>

<div class="space-y-4">
	<!-- Search bar with prefix selector -->
	<div>
		<Label for="customer-lookup" class="mb-2 text-sm font-semibold">Cliente (Documento) *</Label>
		<div class="flex gap-2">
			<Select bind:value={docType} disabled={mode === 'found'} class="w-24 shrink-0">
				{#each ID_DOC_PREFIXES as type (type)}
					<option value={type}>{type}</option>
				{/each}
			</Select>
			<div class="relative flex-1">
				<Search class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
				<Input
					id="customer-lookup"
					type="text"
					inputmode="numeric"
					placeholder="12345678"
					value={idDigits}
					oninput={handleDigitsInput}
					onkeydown={handleKeydown}
					disabled={mode === 'found'}
					class="pl-10"
				/>
			</div>
			{#if mode !== 'idle'}
				<Button color="light" onclick={reset} title="Limpiar">
					<X class="h-5 w-5" />
				</Button>
			{:else}
				<Button color="blue" onclick={handleSearch} disabled={!idDigits.trim() || searching}>
					{#if searching}
						<Spinner size="4" />
					{:else}
						Buscar
					{/if}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Found customer -->
	{#if mode === 'found' && foundCustomer}
		<div class="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
				<UserCheck class="h-5 w-5 text-emerald-600" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-base font-semibold text-emerald-900">
					{foundCustomer.firstName}
					{foundCustomer.lastName}
				</p>
				<p class="text-sm text-emerald-700">
					Doc: <span class="font-mono">{foundCustomer.idNumber}</span>
					{#if foundCustomer.primaryPhone}
						· Tel: {foundCustomer.primaryPhone}
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<!-- Create new customer inline -->
	{#if mode === 'create'}
		<div class="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
			<div class="mb-4 flex items-center gap-2">
				<UserPlus class="h-5 w-5 text-amber-600" />
				<p class="text-base font-semibold text-amber-800">Cliente no encontrado — crear nuevo</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="new-firstName" class="mb-1.5 text-sm">Nombre *</Label>
					<Input
						id="new-firstName"
						bind:value={firstName}
						oninput={syncNewCustomer}
						placeholder="Nombre"
					/>
				</div>
				<div>
					<Label for="new-lastName" class="mb-1.5 text-sm">Apellido *</Label>
					<Input
						id="new-lastName"
						bind:value={lastName}
						oninput={syncNewCustomer}
						placeholder="Apellido"
					/>
				</div>
				<div>
					<Label for="new-phone" class="mb-1.5 text-sm">Teléfono</Label>
					<Input
						id="new-phone"
						bind:value={primaryPhone}
						oninput={syncNewCustomer}
						placeholder="0414-1234567"
					/>
				</div>
				<div>
					<Label for="new-email" class="mb-1.5 text-sm">Email</Label>
					<Input
						id="new-email"
						type="email"
						bind:value={email}
						oninput={syncNewCustomer}
						placeholder="correo@ejemplo.com"
					/>
				</div>
				<div class="sm:col-span-2">
					<Label for="new-address" class="mb-1.5 text-sm">Dirección</Label>
					<Textarea
						id="new-address"
						bind:value={address}
						oninput={syncNewCustomer}
						placeholder="Dirección del cliente"
						rows={2}
					/>
				</div>
			</div>

			{#if !firstName || !lastName}
				<Helper color="red" class="mt-3 text-sm">Nombre y apellido son requeridos</Helper>
			{/if}
		</div>
	{/if}
</div>
