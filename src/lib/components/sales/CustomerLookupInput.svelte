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
		customerId: string;
		newCustomer: {
			firstName: string;
			lastName: string;
			idNumber: string;
			primaryPhone: string;
			email: string;
			address: string;
			notes: string;
		} | null;
		selectedCustomer: Customer | null;
		creatingCustomer?: boolean;
		onchange?: () => void;
	}

	let {
		customerId = $bindable(),
		newCustomer = $bindable(),
		selectedCustomer = $bindable(),
		creatingCustomer = $bindable(false),
		onchange
	}: Props = $props();

	let docType = $state<IdDocPrefix>('V');
	let idDigits = $state('');
	let searching = $state(false);
	let foundCustomer = $state<Customer | null>(selectedCustomer);
	let mode = $state<'idle' | 'found' | 'missing' | 'create'>(
		newCustomer ? 'create' : selectedCustomer ? 'found' : 'idle'
	);

	let firstName = $state(newCustomer?.firstName ?? '');
	let lastName = $state(newCustomer?.lastName ?? '');
	let primaryPhone = $state(newCustomer?.primaryPhone ?? '');
	let email = $state(newCustomer?.email ?? '');
	let address = $state(newCustomer?.address ?? '');
	let customerNotes = $state(newCustomer?.notes ?? '');

	let touchedFirstName = $state(false);
	let touchedLastName = $state(false);
	let touchedIdDigits = $state(false);

	const fieldLabelClass = 'text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase';
	const fieldInputClass =
		'w-full rounded-lg border-none bg-surface-container-high px-3 py-2.5 text-sm text-on-surface placeholder:text-slate-400 focus:ring-1 focus:ring-brand-blue';
	const prefixSelectClass =
		'rounded-lg border-none bg-surface-container-high px-2 py-2.5 text-sm text-on-surface focus:ring-1 focus:ring-brand-blue text-center font-semibold shrink-0';

	const firstNameError = $derived(touchedFirstName && !firstName.trim());
	const lastNameError = $derived(touchedLastName && !lastName.trim());
	const idDigitsError = $derived(touchedIdDigits && !idDigits.trim());

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

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleDigitsInput(e: Event) {
		const input = e.target as HTMLInputElement;
		idDigits = input.value.replace(/\D/g, '').slice(0, 10);

		if (mode !== 'create') {
			clearResolvedState();
		} else {
			syncNewCustomer();
		}

		clearTimeout(searchTimeout);
		if (idDigits.length >= 1 && mode !== 'create') {
			searching = true;
			searchTimeout = setTimeout(() => void handleSearch(), 600);
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
		if (!fullId) {
			searching = false;
			return;
		}

		searching = true;
		try {
			const result = await lookupCustomer({ idNumber: fullId }).run();

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
			clearTimeout(searchTimeout);
			void handleSearch();
		}
	}

	function startCreateMode() {
		clearResolvedState();
		creatingCustomer = true;
		mode = 'create';
		touchedFirstName = false;
		touchedLastName = false;
		touchedIdDigits = false;
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
		touchedFirstName = false;
		touchedLastName = false;
		touchedIdDigits = false;
		onchange?.();
	}

	function reset() {
		clearTimeout(searchTimeout);
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
		touchedFirstName = false;
		touchedLastName = false;
		touchedIdDigits = false;
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

<div class="space-y-3">
	{#if mode !== 'create'}
		<!-- Search row: prefix + document input + buttons inline -->
		<div class="flex items-center gap-2">
			<select
				value={docType}
				onchange={handleDocTypeChange}
				class="{prefixSelectClass} w-14"
				aria-label="Prefijo de documento"
			>
				{#each ID_DOC_PREFIXES as type (type)}
					<option value={type}>{type}</option>
				{/each}
			</select>

			<div class="relative min-w-0 flex-1">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline"
				/>
				<input
					type="text"
					inputmode="numeric"
					placeholder="Cédula o RIF..."
					value={idDigits}
					oninput={handleDigitsInput}
					onkeydown={handleKeydown}
					class="{fieldInputClass} pl-10 {idDigitsError ? 'ring-1 ring-error/40' : ''}"
					onblur={() => (touchedIdDigits = true)}
				/>
				{#if searching}
					<div
						class="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-blue/30 border-t-brand-blue"
					></div>
				{/if}
			</div>

			<button
				type="button"
				onclick={startCreateMode}
				aria-label="Nuevo cliente"
				title="Nuevo cliente"
				class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue transition-colors hover:bg-brand-blue/15"
			>
				<UserPlus class="h-4 w-4" />
			</button>

			{#if mode !== 'idle' || idDigits}
				<button
					type="button"
					onclick={reset}
					aria-label="Limpiar"
					title="Limpiar"
					class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>

		{#if mode === 'found' && foundCustomer}
			<div class="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info-container text-sm font-bold text-brand-navy"
					>
						{customerInitials(foundCustomer)}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-lg font-semibold text-brand-navy">
							{foundCustomer.firstName}
							{foundCustomer.lastName}
						</p>
						<div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
							<span class="inline-flex items-center gap-1 font-mono">
								<IdCard class="h-3 w-3 text-outline" />
								{foundCustomer.idNumber}
							</span>
							{#if foundCustomer.primaryPhone}
								<span class="inline-flex items-center gap-1">
									<Phone class="h-3 w-3 text-outline" />
									{foundCustomer.primaryPhone}
								</span>
							{/if}
							{#if foundCustomer.email}
								<span class="inline-flex items-center gap-1">
									<Mail class="h-3 w-3 text-outline" />
									{foundCustomer.email}
								</span>
							{/if}
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-1.5">
						<span
							class="rounded-full bg-brand-gold px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] text-brand-navy uppercase"
						>
							Seleccionado
						</span>
						<CheckCircle2 class="h-4 w-4 text-brand-blue" />
					</div>
				</div>
			</div>
		{:else if mode === 'missing'}
			<div
				transition:slide={{ duration: 180 }}
				class="flex items-center gap-3 rounded-lg bg-warning-container/50 px-4 py-3"
			>
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<CircleAlert class="h-4 w-4" />
				</div>
				<p class="min-w-0 flex-1 text-sm text-on-surface">
					No encontramos <span class="font-mono font-semibold">{buildIdNumber()}</span>. ¿Crear
					nuevo cliente?
				</p>
				<button
					type="button"
					onclick={startCreateMode}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-xs font-bold text-brand-navy transition-colors hover:bg-brand-gold-dark"
				>
					<UserPlus class="h-3.5 w-3.5" />
					Crear
				</button>
			</div>
		{/if}
	{/if}

	{#if mode === 'create'}
		<div transition:slide={{ duration: 180 }} class="space-y-3">
			<div class="mb-1 flex items-center justify-between">
				<p class="text-sm font-semibold text-brand-navy">Nuevo cliente</p>
				<button
					type="button"
					onclick={returnToLookup}
					class="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-brand-navy"
				>
					<X class="h-3.5 w-3.5" />
					Volver a búsqueda
				</button>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class={fieldLabelClass} for="new-firstName">Nombre</label>
					<input
						id="new-firstName"
						type="text"
						bind:value={firstName}
						oninput={() => {
							syncNewCustomer();
							touchedFirstName = true;
						}}
						onblur={() => (touchedFirstName = true)}
						placeholder="Ej: Juan"
						class="{fieldInputClass} mt-1 {firstNameError ? 'ring-1 ring-error/40' : ''}"
					/>
					{#if firstNameError}
						<p class="mt-0.5 text-[10px] text-error">Requerido</p>
					{/if}
				</div>

				<div>
					<label class={fieldLabelClass} for="new-lastName">Apellido</label>
					<input
						id="new-lastName"
						type="text"
						bind:value={lastName}
						oninput={() => {
							syncNewCustomer();
							touchedLastName = true;
						}}
						onblur={() => (touchedLastName = true)}
						placeholder="Ej: Pérez"
						class="{fieldInputClass} mt-1 {lastNameError ? 'ring-1 ring-error/40' : ''}"
					/>
					{#if lastNameError}
						<p class="mt-0.5 text-[10px] text-error">Requerido</p>
					{/if}
				</div>

				<div>
					<label class={fieldLabelClass} for="new-idNumber">Documento</label>
					<div class="mt-1 flex gap-2">
						<select
							id="new-doc-type"
							value={docType}
							onchange={handleDocTypeChange}
							class="{prefixSelectClass} w-14"
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
							oninput={(e) => {
								handleDigitsInput(e);
								touchedIdDigits = true;
							}}
							onblur={() => (touchedIdDigits = true)}
							placeholder="00.000.000"
							class="{fieldInputClass} min-w-0 flex-1 {idDigitsError ? 'ring-1 ring-error/40' : ''}"
						/>
					</div>
					{#if idDigitsError}
						<p class="mt-0.5 text-[10px] text-error">Requerido</p>
					{/if}
				</div>

				<div>
					<label class={fieldLabelClass} for="new-phone">Teléfono</label>
					<input
						id="new-phone"
						type="tel"
						bind:value={primaryPhone}
						oninput={syncNewCustomer}
						placeholder="+58 412 000 0000"
						class="{fieldInputClass} mt-1"
					/>
				</div>

				<div class="col-span-2">
					<label class={fieldLabelClass} for="new-email">Email</label>
					<input
						id="new-email"
						type="email"
						bind:value={email}
						oninput={syncNewCustomer}
						placeholder="cliente@ejemplo.com"
						class="{fieldInputClass} mt-1"
					/>
				</div>

				<div class="col-span-2">
					<label class={fieldLabelClass} for="new-address">Dirección</label>
					<textarea
						id="new-address"
						bind:value={address}
						oninput={syncNewCustomer}
						rows={2}
						placeholder="Av. Principal, Centro..."
						class="{fieldInputClass} mt-1 min-h-16 resize-none"
					></textarea>
				</div>
			</div>
		</div>
	{/if}
</div>
