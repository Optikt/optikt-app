<script lang="ts">
	import { X } from '@lucide/svelte';
	import { Tooltip } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { createSupportTicketCommand } from '$lib/remote/supportTickets.remote';
	import {
		ALL_TICKET_CATEGORIES,
		ALL_TICKET_PRIORITIES,
		ALL_TICKET_RELATED_TYPES,
		TICKET_CATEGORY_LABELS,
		TICKET_PRIORITY_LABELS,
		TICKET_RELATED_TYPE_LABELS,
		TicketCategory,
		TicketPriority,
		TicketRelatedType
	} from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		open?: boolean;
		onCreated?: () => void;
		onClose?: () => void;
	}

	let { open = $bindable(false), onCreated, onClose }: Props = $props();

	let submitting = $state(false);
	let title = $state('');
	let description = $state('');
	let category = $state<TicketCategory | ''>('');
	let priority = $state<TicketPriority>(TicketPriority.MEDIUM);
	let relatedType = $state<TicketRelatedType | ''>('');
	let relatedLabel = $state('');

	const labelClass = 'text-[11px] font-semibold tracking-[0.18em] text-outline uppercase';
	const inputClass =
		'w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';

	const canSubmit = $derived(
		title.trim().length >= 3 && description.trim().length >= 10 && category !== ''
	);

	const missingFields = $derived(
		[
			title.trim().length < 3 ? 'Título (mínimo 3 caracteres)' : null,
			description.trim().length < 10 ? 'Descripción (mínimo 10 caracteres)' : null,
			category === '' ? 'Categoría (elige una opción)' : null
		].filter((field): field is string => field !== null)
	);

	function reset() {
		title = '';
		description = '';
		category = '';
		priority = TicketPriority.MEDIUM;
		relatedType = '';
		relatedLabel = '';
	}

	function close() {
		open = false;
		onClose?.();
	}

	// Close with Escape only; the backdrop intentionally stays inert.
	$effect(() => {
		if (!open) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				close();
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;

		if (!canSubmit) {
			toast.error(`Falta completar: ${missingFields.join(', ')}`);
			return;
		}
		if (category === '') return;

		submitting = true;
		try {
			await createSupportTicketCommand({
				title,
				description,
				category,
				priority,
				relatedType: relatedType || undefined,
				relatedLabel: relatedLabel || undefined
			});
			toast.success('Ticket creado');
			reset();
			open = false;
			onCreated?.();
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo crear el ticket'));
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet submitTrigger({ props }: { props: Record<string, unknown> })}
	<button
		type="submit"
		{...props}
		aria-disabled={submitting || !canSubmit}
		class="w-full rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition hover:bg-brand-gold-dark aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
	>
		{submitting ? 'Enviando...' : 'Crear ticket'}
	</button>
{/snippet}

{#if open}
	<div
		class="fixed inset-0 z-50 bg-brand-navy/40 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-support-ticket-title"
	>
		<div class="flex h-full items-end justify-center p-2 sm:items-center sm:p-4">
			<form
				onsubmit={handleSubmit}
				novalidate
				class="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-surface-container-lowest shadow-xl sm:max-h-[90dvh]"
			>
				<div class="border-b border-surface-container-high px-4 py-4 sm:px-6">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class={labelClass}>Soporte</p>
							<h2
								id="new-support-ticket-title"
								class="mt-1 text-xl font-semibold tracking-[-0.02em] text-brand-navy"
							>
								Reportar problema o duda
							</h2>
							<p class="mt-1 text-sm text-on-surface-variant">
								Describe qué pasó o qué necesitas. Queda registrado para no perderle la pista.
							</p>
						</div>
						<button
							type="button"
							onclick={close}
							class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-brand-navy transition hover:bg-surface-container-high"
							aria-label="Cerrar formulario de ticket"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="col-span-full flex flex-col gap-1.5 text-sm">
							<span class={labelClass}
								>Título<span class="ml-0.5 text-sm leading-none font-bold text-error">*</span></span
							>
							<input
								type="text"
								bind:value={title}
								required
								minlength="3"
								maxlength="120"
								class={inputClass}
								placeholder="Ej: Error al confirmar una venta"
							/>
						</label>

						<label class="col-span-full flex flex-col gap-1.5 text-sm">
							<span class={labelClass}
								>Descripción<span class="ml-0.5 text-sm leading-none font-bold text-error">*</span
								></span
							>
							<textarea
								bind:value={description}
								required
								minlength="10"
								maxlength="4000"
								rows="5"
								class={inputClass}
								placeholder="¿Qué intentabas hacer? ¿Qué esperabas y qué pasó?"></textarea>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class={labelClass}
								>Categoría<span class="ml-0.5 text-sm leading-none font-bold text-error">*</span
								></span
							>
							<select bind:value={category} required class={inputClass}>
								<option value="" disabled>Seleccionar</option>
								{#each ALL_TICKET_CATEGORIES as c (c)}
									<option value={c}>{TICKET_CATEGORY_LABELS[c]}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class={labelClass}>Prioridad</span>
							<select bind:value={priority} class={inputClass}>
								{#each ALL_TICKET_PRIORITIES as p (p)}
									<option value={p}>{TICKET_PRIORITY_LABELS[p]}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class={labelClass}>Relacionado con</span>
							<select bind:value={relatedType} class={inputClass}>
								<option value="">Sin referencia</option>
								{#each ALL_TICKET_RELATED_TYPES as t (t)}
									<option value={t}>{TICKET_RELATED_TYPE_LABELS[t]}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class={labelClass}>Referencia</span>
							<input
								type="text"
								bind:value={relatedLabel}
								maxlength="120"
								class={`${inputClass} transition-colors disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-slate-400 disabled:opacity-60`}
								placeholder={relatedType
									? 'Ej: Venta #123, cliente Juan Pérez'
									: 'Elige primero "Relacionado con"'}
								disabled={!relatedType}
							/>
						</label>
					</div>
				</div>

				<div
					class="border-t border-surface-container-high bg-surface-container-low px-4 py-3 sm:px-6"
				>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={close}
							disabled={submitting}
							class="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-surface-container-highest disabled:opacity-50"
						>
							Cancelar
						</button>
						<Tooltip.Provider delayDuration={150}>
							<Tooltip.Root>
								<Tooltip.Trigger child={submitTrigger} />
								<Tooltip.Portal>
									<Tooltip.Content
										side="top"
										sideOffset={6}
										class="z-[70] max-w-72 rounded-xl bg-brand-navy px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-xl"
									>
										{#if missingFields.length > 0}
											<p class="font-semibold">Falta completar:</p>
											<ul class="mt-1 list-disc space-y-0.5 pl-4">
												{#each missingFields as field (field)}
													<li>{field}</li>
												{/each}
											</ul>
										{:else}
											<p>Todo listo para crear el ticket</p>
										{/if}
										<Tooltip.Arrow class="fill-brand-navy" />
									</Tooltip.Content>
								</Tooltip.Portal>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
