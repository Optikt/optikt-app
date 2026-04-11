<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, CalendarDays, Hash, Info, UserPlus } from '@lucide/svelte';
	import { dateToISODateString } from '$lib/utils';
	import { fromISODate } from '$lib/dates';
	import CustomerLookupInput from './CustomerLookupInput.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from './newSaleTypes';

	interface Props {
		customerId: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		saleDate: Date;
		notes: string;
		nextOrderNumber?: number;
		valid: boolean;
		onnext: () => void;
	}

	let {
		customerId = $bindable(),
		selectedCustomer = $bindable(),
		newCustomer = $bindable(),
		saleDate = $bindable(),
		notes = $bindable(),
		nextOrderNumber,
		valid,
		onnext
	}: Props = $props();

	let creatingCustomer = $state(newCustomer !== null);

	const fieldLabelClass = 'text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase';
	const fieldInputClass =
		'w-full rounded-xl border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';

	let helperTitle = $derived(
		creatingCustomer
			? 'Alta inline'
			: selectedCustomer
				? 'Cliente listo para asociar'
				: 'Nota del sistema'
	);

	let helperCopy = $derived.by(() => {
		if (creatingCustomer) {
			return 'Completa nombre, apellido y documento para registrar al cliente sin salir de la venta.';
		}

		if (selectedCustomer) {
			return `La venta quedará vinculada a ${selectedCustomer.firstName} ${selectedCustomer.lastName}. Puedes continuar o buscar otro cliente.`;
		}

		return 'Busca por cédula o RIF para reutilizar un cliente existente. Si aún no existe, abre el registro inline desde el botón de nuevo cliente.';
	});
</script>

<div class="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
	<aside class="space-y-4">
		{#if creatingCustomer}
			<div
				class="rounded-[1.75rem] bg-brand-navy px-6 py-7 text-white shadow-[0_18px_44px_rgba(21,35,70,0.18)]"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-gold"
				>
					<UserPlus class="h-5 w-5" />
				</div>
				<p class="mt-6 text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">
					Registro inline
				</p>
				<h3 class="font-heading mt-2 text-3xl font-bold tracking-[-0.03em] text-white">
					Registro de Nuevo Cliente
				</h3>

				<div class="mt-4 rounded-[1.25rem] bg-white/8 px-4 py-4">
					<p class="text-[10px] font-semibold tracking-[0.18em] text-white/55 uppercase">
						Tipo de registro
					</p>
					<p class="mt-2 text-sm font-semibold text-white">Cliente particular</p>
				</div>
			</div>

			<div class="rounded-[1.5rem] bg-surface-container-lowest px-5 py-5 shadow-sm">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
					Guía rápida
				</p>
				<div class="mt-4 space-y-3 text-sm leading-6 text-on-surface-variant">
					<p>Usa nombre y apellido reales para mantener el historial clínico y comercial limpio.</p>
					<p>
						Si el documento ya existe, vuelve a búsqueda y selecciona el cliente antes de continuar.
					</p>
				</div>
			</div>
		{:else}
			<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
				<div class="flex items-center gap-2 text-brand-blue">
					<Hash class="h-4 w-4" />
					<p class={fieldLabelClass}>Detalles de la orden</p>
				</div>

				<div class="mt-5 space-y-5">
					<div>
						<p class={fieldLabelClass}>Número de orden</p>
						<div
							class="mt-2 rounded-xl bg-surface-container-high px-4 py-3 font-mono text-lg font-bold text-brand-navy"
						>
							#{String(nextOrderNumber ?? 0).padStart(4, '0')}
						</div>
					</div>

					<div>
						<label class={fieldLabelClass} for="saleDate">Fecha de venta</label>
						<div class="relative mt-2">
							<input
								id="saleDate"
								type="date"
								value={dateToISODateString(saleDate)}
								oninput={(e: Event) => {
									const target = e.target as HTMLInputElement;
									saleDate = fromISODate(target.value) ?? saleDate;
								}}
								class={`${fieldInputClass} pr-12`}
							/>
							<CalendarDays
								class="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-outline"
							/>
						</div>
						<p class="mt-2 text-xs leading-5 text-on-surface-variant">
							Puedes modificarla si estás registrando una venta anterior.
						</p>
					</div>
				</div>
			</div>

			<div class="rounded-[1.5rem] bg-surface-container-lowest px-5 py-5 shadow-sm">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold-dark"
				>
					<Info class="h-5 w-5" />
				</div>
				<p class="mt-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
					{helperTitle}
				</p>
				<p class="mt-2 text-sm leading-6 text-on-surface-variant">{helperCopy}</p>
			</div>
		{/if}
	</aside>

	<section class="rounded-[1.75rem] bg-surface-container-lowest shadow-sm">
		<div class="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
			<div class="space-y-2">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-brand-blue uppercase">
					Paso 1 · Información
				</p>
				<h2
					class="font-heading text-2xl font-bold tracking-[-0.03em] text-brand-navy sm:text-[2.1rem]"
				>
					Selecciona o registra al cliente
				</h2>
				<p class="max-w-2xl text-sm leading-6 text-on-surface-variant">
					Busca por documento para reutilizar un cliente existente o crea uno nuevo desde este mismo
					paso.
				</p>
			</div>

			<div class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.95fr)]">
				<div class="rounded-[1.5rem] bg-surface-container-low p-5 sm:p-6">
					<CustomerLookupInput
						bind:customerId
						bind:newCustomer
						bind:selectedCustomer
						bind:creatingCustomer
					/>
				</div>

				<div class="rounded-[1.5rem] bg-surface-container-low p-5 sm:p-6">
					<label for="notes" class={fieldLabelClass}>Nota de la venta</label>
					<p class="mt-2 text-sm leading-6 text-on-surface-variant">
						Usa este espacio para acuerdos especiales, observaciones del cliente o contexto para el
						equipo.
					</p>
					<textarea
						id="notes"
						bind:value={notes}
						rows={creatingCustomer ? 8 : 6}
						placeholder="Ej: montura propia, prioridad de entrega, indicaciones internas..."
						class={`${fieldInputClass} mt-3 min-h-40 resize-none`}
					></textarea>
				</div>
			</div>
		</div>

		<div
			class="flex flex-col gap-4 bg-surface-container-low px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
		>
			<a
				href={resolve('/sales')}
				class="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800"
			>
				Cancelar venta
			</a>

			<button
				type="button"
				onclick={onnext}
				disabled={!valid}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(21,35,70,0.18)] transition-all hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline disabled:shadow-none"
			>
				Siguiente
				<ArrowRight class="h-4 w-4" />
			</button>
		</div>
	</section>
</div>
