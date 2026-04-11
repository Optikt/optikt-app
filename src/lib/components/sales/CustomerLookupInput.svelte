<script lang="ts">
	import { slide } from 'svelte/transition';
	import {
		CheckCircle2,
		CircleAlert,
		IdCard,
		Mail,
		Phone,
		Search,
		UserPlus,
		X
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { lookupCustomer } from '$lib/remote/sales.remote';
	import { getErrorMessage, ID_DOC_PREFIXES, ID_NUMBER_RE, type IdDocPrefix } from '$lib/utils';
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
		/** Exposes whether the inline create form is visible */
		creatingCustomer?: boolean;
		/** Callback when customer selection changes */
		onchange?: () => void;
	}

	let {
		customerId = $bindable(),
		newCustomer = $bindable(),
		selectedCustomer = $bindable(),
		creatingCustomer = $bindable(false),
		onchange
	}: Props = $props();

	// Lookup state
	let docType = $state<IdDocPrefix>('V');
	let idDigits = $state('');
	let searching = $state(false);
	let foundCustomer = $state<Customer | null>(selectedCustomer);
	let mode = $state<'idle' | 'found' | 'missing' | 'create'>(
		newCustomer ? 'create' : selectedCustomer ? 'found' : 'idle'
	);

	// Inline creation fields
	let firstName = $state(newCustomer?.firstName ?? '');
	let lastName = $state(newCustomer?.lastName ?? '');
	let primaryPhone = $state(newCustomer?.primaryPhone ?? '');
	let email = $state(newCustomer?.email ?? '');
	let address = $state(newCustomer?.address ?? '');
	let customerNotes = $state(newCustomer?.notes ?? '');

	const fieldLabelClass = 'text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase';
	const fieldInputClass =
		'w-full rounded-xl border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';

	function applyIdNumberValue(value: string) {
		const match = value.match(ID_NUMBER_RE);
		if (match) {
			docType = match[1] as IdDocPrefix;
			idDigits = match[2];
			return;
		}

		idDigits = value.replace(/\D/g, '').slice(0, 10);
	}

	if (newCustomer?.idNumber) {
		applyIdNumberValue(newCustomer.idNumber);
		creatingCustomer = true;
	}

	if (selectedCustomer?.idNumber) {
		applyIdNumberValue(selectedCustomer.idNumber);
	}

	/** Build the full normalized idNumber from prefix + digits */
	function buildIdNumber(): string {
		const digits = idDigits.replace(/\D/g, '');
		if (!digits) return '';
		return `${docType}-${digits}`;
	}

	function customerInitials(customer: Customer): string {
		const first = customer.firstName?.charAt(0) ?? '';
		const last = customer.lastName?.charAt(0) ?? '';
		return `${first}${last}`.toUpperCase() || 'CL';
	}

	function clearResolvedState() {
		foundCustomer = null;
		customerId = '';
		selectedCustomer = null;
		if (!creatingCustomer) {
			mode = 'idle';
		}
	}

	/** Handle digit input — only allow numbers, max 10 digits */
	function handleDigitsInput(e: Event) {
		const input = e.target as HTMLInputElement;
		idDigits = input.value.replace(/\D/g, '').slice(0, 10);

		if (mode !== 'create') {
			clearResolvedState();
		} else {
			syncNewCustomer();
		}
	}

	function handleDocTypeChange(e: Event) {
		docType = (e.target as HTMLSelectElement).value as IdDocPrefix;

		if (mode !== 'create') {
			clearResolvedState();
		} else {
			syncNewCustomer();
		}
	}

	async function handleSearch() {
		const fullId = buildIdNumber();
		if (!fullId) return;

		searching = true;
		try {
			const result = await lookupCustomer({ idNumber: fullId });

			if (result.customer) {
				foundCustomer = result.customer;
				applyIdNumberValue(result.customer.idNumber ?? fullId);
				customerId = result.customer.id;
				newCustomer = null;
				selectedCustomer = result.customer;
				mode = 'found';
				creatingCustomer = false;
			} else {
				foundCustomer = null;
				customerId = '';
				selectedCustomer = null;
				newCustomer = null;
				mode = 'missing';
				creatingCustomer = false;
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

	function startCreateMode() {
		clearResolvedState();
		creatingCustomer = true;
		mode = 'create';
		syncNewCustomer();
		onchange?.();
	}

	function returnToLookup() {
		creatingCustomer = false;
		mode = 'idle';
		newCustomer = null;
		firstName = '';
		lastName = '';
		primaryPhone = '';
		email = '';
		address = '';
		customerNotes = '';
		onchange?.();
	}

	function reset() {
		docType = 'V';
		idDigits = '';
		foundCustomer = null;
		mode = 'idle';
		creatingCustomer = false;
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
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<p class={fieldLabelClass}>Cliente</p>

		<div class="flex items-center gap-2">
			{#if mode !== 'idle' || idDigits}
				<button
					type="button"
					onclick={reset}
					class="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold tracking-[0.16em] text-on-surface-variant uppercase transition-colors hover:bg-surface-container-high"
				>
					<X class="h-4 w-4" />
					Limpiar
				</button>
			{/if}

			<button
				type="button"
				onclick={creatingCustomer ? returnToLookup : startCreateMode}
				aria-label={creatingCustomer ? 'Volver a búsqueda' : 'Nuevo cliente'}
				title={creatingCustomer ? 'Volver a búsqueda' : 'Nuevo cliente'}
				class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue transition-colors hover:bg-brand-blue/15"
			>
				{#if creatingCustomer}
					<X class="h-5 w-5" />
				{:else}
					<UserPlus class="h-6 w-6" />
				{/if}
			</button>
		</div>
	</div>

	{#if mode !== 'create'}
		<div class="grid gap-3 lg:max-w-[34rem] lg:grid-cols-[4.75rem_minmax(14rem,20rem)_auto]">
			<div>
				<label class={fieldLabelClass} for="customer-doc-type">Prefijo</label>
				<select
					id="customer-doc-type"
					value={docType}
					onchange={handleDocTypeChange}
					class={`${fieldInputClass} mt-2`}
				>
					{#each ID_DOC_PREFIXES as type (type)}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class={fieldLabelClass} for="customer-lookup">Documento</label>
				<div class="relative mt-2">
					<Search
						class="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline"
					/>
					<input
						id="customer-lookup"
						type="text"
						inputmode="numeric"
						placeholder="Ingrese Cédula o RIF para buscar..."
						value={idDigits}
						oninput={handleDigitsInput}
						onkeydown={handleKeydown}
						class={`${fieldInputClass} pl-11`}
					/>
				</div>
			</div>

			<div class="lg:self-end">
				<button
					type="button"
					onclick={handleSearch}
					disabled={!idDigits.trim() || searching}
					class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(21,35,70,0.18)] transition-all hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline disabled:shadow-none lg:w-auto"
				>
					{#if searching}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></span>
					{:else}
						<Search class="h-4 w-4" />
					{/if}
					Buscar
				</button>
			</div>
		</div>

		{#if mode === 'found' && foundCustomer}
			<div class="rounded-[1.5rem] bg-surface-container-lowest px-5 py-5 shadow-sm">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex items-start gap-4">
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl bg-info-container text-sm font-bold text-brand-navy"
						>
							{customerInitials(foundCustomer)}
						</div>

						<div class="min-w-0">
							<p class="text-xl font-semibold text-brand-navy">
								{foundCustomer.firstName}
								{foundCustomer.lastName}
							</p>
							<div class="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-sm text-on-surface-variant">
								<span class="inline-flex items-center gap-1.5 font-mono">
									<IdCard class="h-4 w-4 text-outline" />
									{foundCustomer.idNumber}
								</span>
								{#if foundCustomer.primaryPhone}
									<span class="inline-flex items-center gap-1.5">
										<Phone class="h-4 w-4 text-outline" />
										{foundCustomer.primaryPhone}
									</span>
								{/if}
								{#if foundCustomer.email}
									<span class="inline-flex items-center gap-1.5">
										<Mail class="h-4 w-4 text-outline" />
										{foundCustomer.email}
									</span>
								{/if}
							</div>
						</div>
					</div>

					<div class="flex items-center gap-2 text-brand-blue">
						<span
							class="rounded-full bg-brand-gold px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-navy uppercase"
						>
							Cliente seleccionado
						</span>
						<CheckCircle2 class="h-5 w-5" />
					</div>
				</div>
			</div>
		{:else if mode === 'missing'}
			<div
				transition:slide={{ duration: 180 }}
				class="rounded-[1.5rem] bg-warning-container/50 px-5 py-5 text-on-surface"
			>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex items-start gap-4">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-container text-on-warning-container"
						>
							<CircleAlert class="h-5 w-5" />
						</div>

						<div>
							<p class="text-sm font-semibold text-on-surface">
								No encontramos un cliente con el documento {buildIdNumber()}.
							</p>
							<p class="mt-1 text-sm leading-6 text-on-surface-variant">
								Puedes revisar el documento o abrir el registro inline para crearlo ahora.
							</p>
						</div>
					</div>

					<button
						type="button"
						onclick={startCreateMode}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-navy-dark"
					>
						<UserPlus class="h-4 w-4" />
						Crear cliente
					</button>
				</div>
			</div>
		{/if}
	{/if}

	{#if mode === 'create'}
		<div transition:slide={{ duration: 180 }} class="space-y-5">
			<div class="grid gap-4 md:grid-cols-12">
				<div class="md:col-span-4">
					<label class={fieldLabelClass} for="new-firstName">Nombre</label>
					<input
						id="new-firstName"
						type="text"
						bind:value={firstName}
						oninput={syncNewCustomer}
						placeholder="Ej: Juan"
						class={`${fieldInputClass} mt-2`}
					/>
				</div>

				<div class="md:col-span-4">
					<label class={fieldLabelClass} for="new-lastName">Apellido</label>
					<input
						id="new-lastName"
						type="text"
						bind:value={lastName}
						oninput={syncNewCustomer}
						placeholder="Ej: Pérez"
						class={`${fieldInputClass} mt-2`}
					/>
				</div>

				<div class="md:col-span-4">
					<!-- <label class={fieldLabelClass} for="new-idNumber">Documento de identidad</label> -->
					<label class={fieldLabelClass} for="new-idNumber">CI</label>
					<div class="mt-2 grid gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
						<select
							id="new-doc-type"
							value={docType}
							onchange={handleDocTypeChange}
							class={`${fieldInputClass} w-fit`}
						>
							{#each ID_DOC_PREFIXES as type (type)}
								<option value={type}>{type}</option>
							{/each}
						</select>
						<input
							id="new-idNumber"
							type="text"
							inputmode="numeric"
							value={idDigits}
							oninput={handleDigitsInput}
							placeholder="00.000.000"
							class={fieldInputClass}
						/>
					</div>
				</div>

				<div class="md:col-span-5">
					<label class={fieldLabelClass} for="new-phone">Teléfono</label>
					<input
						id="new-phone"
						type="tel"
						bind:value={primaryPhone}
						oninput={syncNewCustomer}
						placeholder="+58 412 000 0000"
						class={`${fieldInputClass} mt-2`}
					/>
				</div>

				<div class="md:col-span-7">
					<label class={fieldLabelClass} for="new-email">Email</label>
					<input
						id="new-email"
						type="email"
						bind:value={email}
						oninput={syncNewCustomer}
						placeholder="cliente@ejemplo.com"
						class={`${fieldInputClass} mt-2`}
					/>
				</div>

				<div class="md:col-span-12">
					<label class={fieldLabelClass} for="new-address">Dirección</label>
					<textarea
						id="new-address"
						bind:value={address}
						oninput={syncNewCustomer}
						rows={2}
						placeholder="Av. Principal, Centro..."
						class={`${fieldInputClass} mt-2 min-h-24 resize-none md:max-w-[32rem]`}
					></textarea>
				</div>
			</div>

			{#if !firstName.trim() || !lastName.trim() || !buildIdNumber()}
				<p class="rounded-xl bg-warning-container/60 px-4 py-3 text-sm text-on-warning-container">
					Nombre, apellido y documento son requeridos para continuar al siguiente paso.
				</p>
			{/if}
		</div>
	{/if}
</div>
