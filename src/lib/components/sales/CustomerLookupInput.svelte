<script lang="ts">
	import { slide } from 'svelte/transition';
	import {
		CircleCheck,
		CircleAlert,
		IdCard,
		Mail,
		Phone,
		UserPlus,
		ArrowLeft,
		X
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { lookupCustomer } from '$lib/remote/sales.remote';
	import { getErrorMessage, ID_DOC_PREFIXES, ID_NUMBER_RE, type IdDocPrefix } from '$lib/utils';
	import type { Customer } from '$lib/server/db/schema';
	import { IdInput } from '$lib/components/ui';

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
		resetKey?: number;
		onchange?: () => void;
	}

	let {
		customerId = $bindable(),
		newCustomer = $bindable(),
		selectedCustomer = $bindable(),
		creatingCustomer = $bindable(false),
		resetKey = 0,
		onchange
	}: Props = $props();

	let docType = $state<IdDocPrefix>('V');
	let idDigits = $state('');
	let idValue = $state('');
	let prevDocType = $state<IdDocPrefix>('V');
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

	const firstNameError = $derived(touchedFirstName && !firstName.trim());
	const lastNameError = $derived(touchedLastName && !lastName.trim());
	const parsedIdDigits = $derived.by((): string => {
		const match = idValue.match(ID_NUMBER_RE);
		return match ? match[2] : '';
	});
	const idDigitsError = $derived(touchedIdDigits && !parsedIdDigits);
	const hasIdValue = $derived(parsedIdDigits.length > 0);

	function applyIdNumberValue(value: string) {
		idValue = value;
		const match = value.match(ID_NUMBER_RE);
		if (match) {
			prevDocType = match[1] as IdDocPrefix;
			docType = match[1] as IdDocPrefix;
		}
	}

	if (newCustomer?.idNumber) {
		applyIdNumberValue(newCustomer.idNumber);
		creatingCustomer = true;
	}

	if (selectedCustomer?.idNumber) {
		applyIdNumberValue(selectedCustomer.idNumber);
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

	function handleIdChange(val: string) {
		idValue = val;
		const match = val.match(ID_NUMBER_RE);
		const newType = (match?.[1] as IdDocPrefix) || 'V';
		const digits = match?.[2] || '';
		touchedIdDigits = true;

		if (newType !== prevDocType) {
			prevDocType = newType;
			docType = newType;
			if (mode !== 'create') {
				clearResolvedState();
			} else {
				syncNewCustomer();
			}
		}

		clearTimeout(searchTimeout);
		if (digits.length >= 1 && mode !== 'create') {
			searching = true;
			searchTimeout = setTimeout(() => void handleSearch(val), 600);
		}
	}

	async function handleSearch(fullId?: string) {
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
			const match = idValue.match(ID_NUMBER_RE);
			if (match) void handleSearch(`${match[1]}-${match[2]}`);
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

	export function cleanCustomerCreation() {
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

	let prevResetKey: number;

	$effect(() => {
		if (resetKey !== prevResetKey) {
			prevResetKey = resetKey;
			cleanCustomerCreation();
		}
	});

	function reset() {
		clearTimeout(searchTimeout);
		cleanCustomerCreation();
		idValue = '';
		prevDocType = 'V';
		docType = 'V';
		foundCustomer = null;
		customerId = '';
		selectedCustomer = null;
		onchange?.();
	}

	function syncNewCustomer() {
		if (mode === 'create') {
			newCustomer = {
				firstName,
				lastName,
				idNumber: idValue,
				primaryPhone,
				email,
				address,
				notes: customerNotes
			};
		}
	}
</script>

<form class="space-y-2" autocomplete="off" onsubmit={(e) => e.preventDefault()}>
	{#if mode !== 'create'}
		<!-- Search row: document ID + buttons inline -->
		<div class="flex items-center gap-2">
			<div class="min-w-0 flex-1">
				<IdInput bind:value={idValue} onchange={handleIdChange} onkeydown={handleKeydown} />
			</div>
			{#if searching}
				<div
					class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-blue/30 border-t-brand-blue"
				></div>
			{/if}
			<button
				type="button"
				onclick={startCreateMode}
				aria-label="Nuevo cliente"
				title="Nuevo cliente"
				class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue transition-colors hover:bg-brand-blue/15"
			>
				<UserPlus class="h-4 w-4" />
			</button>

			{#if mode !== 'idle' || hasIdValue}
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
			<div
				class="mx-auto w-1/2 rounded-xl border-2 border-success bg-success/5 px-4 py-3 shadow-sm"
			>
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
						<CircleCheck class="h-4 w-4 text-brand-blue" />
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
					No encontramos <span class="font-mono font-semibold">{idValue}</span>. ¿Crear nuevo
					cliente?
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
		<div transition:slide={{ duration: 180 }} class="grid grid-cols-2 gap-2 lg:grid-cols-10">
			<div class="col-span-2">
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

			<div class="col-span-2">
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

			<div class="col-span-3">
				<IdInput
					bind:value={idValue}
					onchange={handleIdChange}
					label="Documento"
					error={idDigitsError ? 'Requerido' : null}
					required
				/>
			</div>

			<div class="col-span-3">
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

			<div class="col-span-4">
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

			<div class="col-span-2 lg:col-span-6">
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
	{/if}
</form>
