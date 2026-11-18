<script lang="ts">
	import '$lib/components/layout/heroNavy.css';
	import { Check, CircleCheck, Info, TriangleAlert, UserRound, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getErrorMessage, formatPrice } from '$lib/utils';
	import { convertQuoteToSale } from '$lib/remote/quotes/lifecycle.remote';
	import { getQuoteConversionPreview } from '$lib/remote/quotes/queries.remote';
	import { getNextOrderNumberCommand } from '$lib/remote/sales/status.remote';
	import CustomerLookupInput from '$lib/components/sales/CustomerLookupInput.svelte';
	import CasheaCheckbox from '$lib/components/sales/CasheaCheckbox.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { logger } from '$lib/utils/logger';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';
	import type { QuoteConversionPreview } from '$lib/server/quotes/conversionPreviewLogic';
	import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import type { Customer } from '$lib/server/db/schema';
	import {
		formatQuoteNumber,
		formatConvertedSaleRef
	} from '$lib/components/quotes/list/quoteListDisplay';

	interface Props {
		quote: QuoteWithRelations;
		open: boolean;
		/** Abre directo en modo "selecciona o registra al cliente" (hero sin cliente). */
		forceCustomerRequired?: boolean;
		onclose: () => void;
		/** Se navega a /sales/[id] al convertir (comportamiento actual de la app). */
		onConverted?: (saleId: string) => void;
	}

	let { quote, open, forceCustomerRequired = false, onclose, onConverted }: Props = $props();

	// ── Estado del cliente ────────────────────────────────────────────────
	// El cliente nuevo NO se crea al tipear: se manda como `newCustomer` en el
	// comando de conversión (una sola tx) — D5.
	let customerId = $state('');
	let selectedCustomer = $state<Customer | null>(null);
	let newCustomer = $state<NewCustomerData | null>(null);
	let lookupKey = $state(0);
	/** 'card' = tarjeta verde · 'lookup' = buscador obligatorio. */
	// seed inicial; el $effect de open recalcula al abrir el modal.
	// svelte-ignore state_referenced_locally
	let customerMode = $state<'card' | 'lookup'>(
		forceCustomerRequired || !quote.customer ? 'lookup' : 'card'
	);

	interface CustomerCard {
		label: string;
		initials: string;
		name: string;
		idNumber: string | null;
		phone: string | null;
	}

	/** Cliente mostrado en la tarjeta verde (existente elegido / heredado / inline nuevo). */
	const card = $derived.by<CustomerCard | null>(() => {
		if (customerMode !== 'card') return null;
		if (selectedCustomer) {
			const name = `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim();
			return {
				label:
					selectedCustomer.id === quote.customer?.id
						? 'Cliente del presupuesto'
						: 'Cliente seleccionado',
				initials: (selectedCustomer.firstName?.[0] ?? '') + (selectedCustomer.lastName?.[0] ?? ''),
				name,
				idNumber: selectedCustomer.idNumber,
				phone: selectedCustomer.primaryPhone
			};
		}
		const inherited = customerId && quote.customer && customerId === quote.customer.id;
		if (inherited && quote.customer) {
			return {
				label: 'Cliente del presupuesto',
				initials: (quote.customer.firstName?.[0] ?? '') + (quote.customer.lastName?.[0] ?? ''),
				name: `${quote.customer.firstName} ${quote.customer.lastName}`.trim(),
				idNumber: quote.customer.idNumber,
				phone: quote.customer.primaryPhone
			};
		}
		if (newCustomer && newCustomer.firstName && newCustomer.lastName) {
			return {
				label: 'Cliente nuevo · se registrará al convertir',
				initials: (newCustomer.firstName?.[0] ?? '') + (newCustomer.lastName?.[0] ?? ''),
				name: `${newCustomer.firstName} ${newCustomer.lastName}`.trim(),
				idNumber: newCustomer.idNumber ?? null,
				phone: newCustomer.primaryPhone ?? null
			};
		}
		return null;
	});

	const hasCustomer = $derived(
		!!customerId || (newCustomer !== null && !!newCustomer.firstName && !!newCustomer.lastName)
	);
	const missing = $derived(hasCustomer ? [] : ['Cliente']);

	// ── Cashea (D4): viene marcado desde el presupuesto, editable aquí ────
	// seed inicial; el $effect de open recalcula.
	// svelte-ignore state_referenced_locally
	let isCashea = $state(quote.isCashea);

	// ── Revisión (misma query que el hero) ────────────────────────────────
	let preview = $state<QuoteConversionPreview | null>(null);
	let previewLoading = $state(false);

	// ── Subtítulo: número de la venta que se creará ───────────────────────
	let nextOrderNumber = $state<number | null>(null);

	$effect(() => {
		if (!open) return;
		isCashea = quote.isCashea;
		customerId = quote.customer?.id ?? '';
		selectedCustomer = null;
		newCustomer = null;
		customerMode = forceCustomerRequired || !quote.customer ? 'lookup' : 'card';
		lookupKey += 1;
		preview = null;

		void (async () => {
			previewLoading = true;
			try {
				const [p, next] = await Promise.all([
					getQuoteConversionPreview({ id: quote.id }),
					getNextOrderNumberCommand({}).catch(() => null)
				]);
				preview = p;
				nextOrderNumber = next;
			} catch (e) {
				logger.error('Error cargando el preview de conversión', e);
			} finally {
				previewLoading = false;
			}
		})();
	});

	function startLookup() {
		customerId = '';
		selectedCustomer = null;
		newCustomer = null;
		customerMode = 'lookup';
		lookupKey += 1;
	}

	function handleLookupChange() {
		if (customerId || (newCustomer && newCustomer.firstName && newCustomer.lastName)) {
			customerMode = 'card';
		}
	}

	// ── Submit ────────────────────────────────────────────────────────────
	let converting = $state(false);

	async function handleConvert(): Promise<void> {
		if (!hasCustomer || converting) return;
		converting = true;
		try {
			const result = await convertQuoteToSale({
				id: quote.id,
				customerId: customerId || undefined,
				newCustomer:
					newCustomer && newCustomer.firstName && newCustomer.lastName ? newCustomer : undefined,
				isCashea
			});
			if (result.success) {
				toast.success(
					`Venta ${formatConvertedSaleRef(result.sale.orderNumber)} creada desde ${formatQuoteNumber(quote.quoteNumber)}`,
					{
						action: {
							label: 'Ver venta',
							onClick: () => goto(resolve(`/sales/${result.sale.id}`))
						}
					}
				);
				onclose();
				if (onConverted) onConverted(result.sale.id);
				else goto(resolve(`/sales/${result.sale.id}`));
			} else {
				toast.error(result.error ?? 'Error convirtiendo el presupuesto');
			}
		} catch (e) {
			logger.error('Error convirtiendo el presupuesto', e);
			toast.error(getErrorMessage(e, 'Error convirtiendo el presupuesto'));
		} finally {
			converting = false;
		}
	}

	// ── Revisión: textos ──────────────────────────────────────────────────
	function stockText(item: {
		stock: { kind: string; available?: number; needed: number };
	}): string {
		if (item.stock.kind === 'untracked') return 'sin control de stock';
		if (item.stock.kind === 'insufficient') {
			return `stock insuficiente (${item.stock.available ?? 0} de ${item.stock.needed})`;
		}
		return `${item.stock.available} en stock`;
	}
</script>

{#if open}
	<!-- Overlay: hoja inferior en móvil (<sm), modal centrado en escritorio -->
	<div class="fixed inset-0 z-[60] grid place-items-end sm:place-items-center">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-[#000d2f]/50"
			aria-label="Cerrar"
			onclick={onclose}
		></button>

		<div
			role="dialog"
			aria-modal="true"
			aria-label="Convertir a venta"
			class="relative flex max-h-[94%] w-full flex-col overflow-hidden rounded-t-2xl bg-surface-drawer shadow-2xl sm:max-h-[90%] sm:max-w-[600px] sm:rounded-2xl"
		>
			<!-- Header navy (franjas) -->
			<header
				class="relative flex min-h-[68px] items-center gap-3 overflow-hidden bg-brand-navy px-5 py-2.5 text-white"
			>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute top-[-10px] right-[90px] bottom-[-10px] w-10 -skew-x-[20deg] bg-brand-blue"
				></span>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute top-[-10px] right-[144px] bottom-[-10px] w-3 -skew-x-[20deg] bg-brand-gold"
				></span>
				<div class="relative z-[1] flex-1">
					<h2 class="font-heading flex items-center gap-2.5 text-[19px] font-bold">
						Convertir a venta
						<span
							class="rounded-[4px] bg-brand-blue px-2 py-px text-[13px] font-bold text-brand-navy"
						>
							{formatQuoteNumber(quote.quoteNumber)}
						</span>
					</h2>
					<p class="mt-0.5 text-[13px] text-[#b8c4de]">
						{#if nextOrderNumber !== null}
							Se creará la venta {formatConvertedSaleRef(nextOrderNumber)} y se descontará el stock
						{:else}
							Se creará una venta nueva y se descontará el stock
						{/if}
					</p>
				</div>
				<button
					type="button"
					onclick={onclose}
					aria-label="Cerrar"
					class="relative z-[1] grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-white/15 text-white ring-1 ring-white/30 transition-colors hover:bg-white/25"
				>
					<X class="h-[18px] w-[18px]" />
				</button>
			</header>

			<!-- Cuerpo -->
			<div class="flex-1 space-y-3 overflow-y-auto p-4">
				<!-- Cliente -->
				<div class="rounded-xl bg-white p-3.5 shadow-sm">
					{#if card}
						<p class="mb-2 text-[11px] font-bold tracking-[0.1em] text-brand-blue uppercase">
							{card.label}
						</p>
						<div
							class="flex items-center gap-3 rounded-xl border-2 border-success bg-success-container/40 px-3 py-2"
						>
							<span
								class="font-heading grid h-9 w-9 place-items-center rounded-lg bg-info-container text-[13px] font-bold text-brand-navy"
							>
								{card.initials.toUpperCase()}
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-[14px] font-bold">{card.name}</p>
								<p class="text-[12px] text-on-surface-variant">
									{card.idNumber}
									{#if card.phone}
										· {card.phone}
									{/if}
								</p>
							</div>
							<button
								type="button"
								onclick={startLookup}
								class="cursor-pointer text-[13px] font-semibold text-brand-blue underline"
							>
								Cambiar
							</button>
						</div>
					{:else}
						<p
							class="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-on-warning-container uppercase"
						>
							<UserRound class="h-3.5 w-3.5" />
							Paso obligatorio · selecciona o registra al cliente
						</p>
						{#if !quote.customer}
							<p class="mt-1 text-[13px] text-on-surface-variant">
								Este presupuesto no tiene cliente. La venta necesita uno.
							</p>
						{/if}
						<div class="mt-2">
							<CustomerLookupInput
								bind:customerId
								bind:selectedCustomer
								bind:newCustomer
								resetKey={lookupKey}
								onchange={handleLookupChange}
							/>
						</div>
						<p class="mt-2 text-[12px] text-outline">
							Si no existe, se registra aquí mismo con el botón de agregar.
						</p>
						<p class="mt-1 text-[12px] text-on-surface-variant">
							Queda asignado también al presupuesto.
						</p>
					{/if}
				</div>

				<!-- Cashea (D4) -->
				<CasheaCheckbox
					bind:isCashea
					size="lg"
					label="Venta con Cashea"
					hint={quote.isCashea
						? 'Viene marcado desde el presupuesto'
						: 'Financia el saldo a través de Cashea'}
				/>

				<!-- Revisión (avisos, no bloqueos — D8) -->
				<div class="rounded-xl bg-white shadow-sm">
					<p class="px-3.5 pt-3 text-[11px] font-bold tracking-[0.1em] text-on-surface uppercase">
						Revisión
					</p>
					{#if previewLoading}
						<div class="flex items-center gap-2 px-3.5 py-3 text-[13px] text-on-surface-variant">
							<span
								class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-blue/30 border-t-brand-blue"
							></span>
							Revisando ítems…
						</div>
					{:else if preview}
						<ul class="mt-1 divide-y divide-outline-variant/40 text-[13px]">
							{#if preview.summary.missingCustomer}
								<li
									class="flex items-center gap-2.5 bg-warning-container/60 px-3.5 py-2.5 font-semibold text-on-warning-container"
								>
									<UserRound class="h-4 w-4 shrink-0 text-warning" />
									<span class="flex-1">Falta el cliente</span>
								</li>
							{/if}
							{#each preview.items as item (item.quoteItemId)}
								<li class="flex items-center gap-2.5 px-3.5 py-2.5">
									{#if item.stock.kind === 'insufficient' || item.price.changed}
										<TriangleAlert class="h-4 w-4 shrink-0 text-warning" />
									{:else}
										<CircleCheck class="h-4 w-4 shrink-0 text-success" />
									{/if}
									<span class="min-w-0 flex-1 truncate">{item.label}</span>
									<span class="shrink-0 text-[12px] text-on-surface-variant">
										{stockText(item)}
									</span>
								</li>
								{#if item.price.changed}
									<li class="bg-warning-container/60 px-3.5 py-2.5">
										<p class="flex items-center gap-2.5">
											<TriangleAlert class="h-4 w-4 shrink-0 text-warning" />
											<span class="min-w-0 flex-1">{item.label} cambió de precio en catálogo</span>
											<span class="font-semibold text-on-warning-container tabular-nums">
												USD {formatPrice(item.price.quoted)} → {formatPrice(
													item.price.current ?? 0
												)}
											</span>
										</p>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
					<p class="px-3.5 pt-1 pb-3 text-[12px] text-on-surface-variant">
						Se respeta el precio presupuestado. Para usar el nuevo, edita el presupuesto antes.
					</p>
				</div>
			</div>

			<!-- Footer navy -->
			<footer class="bg-brand-navy px-5 py-3 text-white">
				<div class="flex items-center gap-3">
					<div class="flex-1">
						<p class="text-[11px] font-bold tracking-[0.1em] text-[#b8c4de] uppercase">
							Total de la venta
						</p>
						<p class="font-heading text-[24px] font-bold tabular-nums">
							{formatPrice(quote.total)}
						</p>
					</div>
					<button
						type="button"
						onclick={onclose}
						class="h-10 cursor-pointer rounded-lg border border-white/50 px-4 text-[13px] font-bold"
					>
						Volver
					</button>
					{#snippet createTrigger({ props }: { props: Record<string, unknown> })}
						<button
							{...props}
							type="button"
							onclick={() => {
								if (hasCustomer && !converting) void handleConvert();
							}}
							aria-disabled={!hasCustomer || converting}
							class="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-bold {hasCustomer &&
							!converting
								? 'bg-brand-gold text-brand-navy hover:bg-brand-gold-dark'
								: 'cursor-not-allowed bg-white/15 text-white/50'}"
						>
							{#if converting}
								<span
									class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
								></span>
								Creando…
							{:else}
								<Check class="h-4 w-4" />
								Crear venta
							{/if}
						</button>
					{/snippet}
					<TriggerTooltip
						title={missing.length > 0 ? 'Falta completar:' : undefined}
						items={missing}
						text={missing.length === 0 ? 'Confirma la conversión' : undefined}
						side="top"
						trigger={createTrigger}
					/>
				</div>
				<!-- En táctil no hay hover: el aviso de faltantes también va inline -->
				{#if !hasCustomer}
					<p
						class="mt-1.5 flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[12px] text-brand-gold"
						role="status"
					>
						<Info class="h-3.5 w-3.5" />
						Falta completar: Cliente
					</p>
				{/if}
			</footer>
		</div>
	</div>
{/if}
