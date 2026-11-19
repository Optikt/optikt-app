<script lang="ts">
	import { ExternalLink, IdCard, MapPin, Phone } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { logger } from '$lib/utils/logger';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { CUSTOMER_GENDER_LABELS, type CustomerGender } from '$lib/shared/enums';
	import { calculateAge } from '$lib/dates';
	import { customerInitials } from './saleDetail';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import type { Snippet } from 'svelte';

	interface Props {
		customer: SaleWithRelations['customer'] | QuoteCustomerLike;
		/** Estado vacío alternativo (presupuestos sin cliente): reemplaza el "—". */
		emptyState?: Snippet;
	}

	interface QuoteCustomerLike {
		id?: string;
		firstName: string;
		lastName: string;
		idNumber?: string | null;
		birthDate?: string | null;
		primaryPhone?: string | null;
		gender?: string | null;
		address?: string | null;
	}

	let { customer, emptyState }: Props = $props();

	const customerId = $derived(customer && 'id' in customer && customer.id ? customer.id : null);

	const customerName = $derived(
		customer ? `${customer.firstName} ${customer.lastName}` : 'Cliente no asignado'
	);
	const initials = $derived(customerInitials(customerName));
	const age = $derived(customer ? calculateAge(customer.birthDate) : null);
	const genderLabel = $derived(
		customer?.gender ? (CUSTOMER_GENDER_LABELS[customer.gender as CustomerGender] ?? null) : null
	);

	async function copyValue(value: string, message: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(message);
		} catch (error) {
			logger.error('No se pudo copiar al portapapeles', error);
			toast.error('No se pudo copiar');
		}
	}
</script>

{#if customer}
	<div
		class="mb-2.5 flex items-start gap-3 rounded-xl border border-white/15 bg-white/[.07] px-3.5 py-2.5"
	>
		<span
			class="font-heading grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-brand-blue text-[15px] font-bold text-brand-navy"
		>
			{initials}
		</span>
		<div class="min-w-0">
			{#snippet nameLink({ props }: { props: Record<string, unknown> })}
				<a
					{...props}
					href={customerId ? resolve(`/customers/${customerId}`) : undefined}
					role={customerId ? undefined : 'presentation'}
					class="font-heading inline-flex items-center gap-1.5 border-b border-dotted border-white/40 text-lg font-bold transition-colors hover:border-white"
				>
					{customerName}
					<ExternalLink class="h-3.5 w-3.5" />
				</a>
			{/snippet}
			<TriggerTooltip trigger={nameLink} text="Ver ficha del cliente" />

			<div class="mt-1.5 flex flex-wrap items-center gap-2">
				{#if customer.idNumber}
					{#snippet cedulaChip({ props }: { props: Record<string, unknown> })}
						<button
							{...props}
							type="button"
							class="inline-flex cursor-copy items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-[3px] text-[13px] font-semibold transition-colors hover:bg-white/25"
							onclick={() => copyValue(customer.idNumber ?? '', 'Cédula copiada')}
						>
							<IdCard class="h-3.5 w-3.5" />
							{customer.idNumber}
						</button>
					{/snippet}
					<TriggerTooltip trigger={cedulaChip} text="Clic para copiar la cédula" />
				{/if}
				{#if customer.primaryPhone}
					{#snippet phoneChip({ props }: { props: Record<string, unknown> })}
						<button
							{...props}
							type="button"
							class="inline-flex cursor-copy items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-[3px] text-[13px] font-semibold transition-colors hover:bg-white/25"
							onclick={() => copyValue(customer.primaryPhone ?? '', 'Teléfono copiado')}
						>
							<Phone class="h-3.5 w-3.5" />
							{customer.primaryPhone}
						</button>
					{/snippet}
					<TriggerTooltip trigger={phoneChip} text="Clic para copiar el teléfono" />
				{/if}
				{#if age !== null}
					<span
						class="inline-flex items-center gap-1.5 rounded-md bg-white/[.07] px-2 py-[3px] text-xs font-semibold text-[#c9d3ea]"
					>
						{age} años
					</span>
				{/if}
				{#if genderLabel}
					<span
						class="inline-flex items-center gap-1.5 rounded-md bg-white/[.07] px-2 py-[3px] text-xs font-semibold text-[#c9d3ea]"
					>
						{genderLabel}
					</span>
				{/if}
			</div>
			{#if customer.address}
				{#snippet addressLine({ props }: { props: Record<string, unknown> })}
					<div
						{...props}
						class="mt-1.5 flex max-w-[470px] items-center gap-1.5 text-xs text-[#c9d3ea]"
					>
						<MapPin class="h-3.5 w-3.5 shrink-0" />
						<span class="customer-address-text truncate">{customer.address}</span>
					</div>
				{/snippet}
				<TriggerTooltip trigger={addressLine} text={customer.address} />
			{/if}
		</div>
	</div>
{:else if emptyState}
	{@render emptyState()}
{:else}
	<div
		class="mb-2.5 flex items-center gap-3 rounded-xl border border-white/15 bg-white/[.07] px-3.5 py-2.5"
	>
		<span
			class="font-heading grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-white/15 text-[15px] font-bold text-[#c9d3ea]"
		>
			—
		</span>
		<p class="text-sm font-semibold text-[#c9d3ea]">Cliente no asignado</p>
	</div>
{/if}

<style>
	/* Móvil <700 (contenedor de página): la dirección envuelve en vez de truncar. */
	@container (max-width: 699px) {
		.customer-address-text {
			white-space: normal;
			overflow-wrap: anywhere;
		}
	}
</style>
