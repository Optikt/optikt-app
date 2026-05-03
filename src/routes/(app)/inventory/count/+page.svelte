<script lang="ts">
	import { ClipboardList, Play, Plus, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { AppBadge, DataGrid, PageHeader } from '$lib/components/ui';
	import { createSession } from '$lib/remote/inventoryCount.remote';
	import {
		formatInventoryCountScope,
		getInventoryCountStatusLabel,
		type InventoryCountScopeType
	} from '$lib/schemas/inventoryCount';
	import { ALL_PRODUCT_TYPES, PRODUCT_TYPE_LABELS, type ProductType } from '$lib/shared/enums';
	import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';
	import { formatDate, getErrorMessage } from '$lib/utils';

	let { data } = $props();
	let sessions = $state<InventoryCountSessionSummary[]>(untrack(() => data.sessions));
	let showCreateModal = $state(false);
	let scopeType = $state<InventoryCountScopeType>('ALL');
	let scopeValue = $state<ProductType | ''>('');
	let notes = $state('');
	let formError = $state('');
	let isSubmitting = $state(false);

	const activeSession = $derived(sessions.find((session) => session.status === 'OPEN') ?? null);
	const canSubmit = $derived(scopeType !== 'PRODUCT_CATEGORY' || scopeValue !== '');
	const historySessions = $derived(sessions);

	const columns = [
		{ key: 'date', label: 'Fecha' },
		{ key: 'scope', label: 'Scope' },
		{ key: 'items', label: 'Ítems', align: 'right' as const },
		{ key: 'in', label: 'Ajustes+', align: 'right' as const },
		{ key: 'out', label: 'Ajustes-', align: 'right' as const },
		{ key: 'matches', label: 'Sin diff', align: 'right' as const },
		{ key: 'status', label: 'Estado' },
		{ key: 'appliedBy', label: 'Aplicado por' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	function statusVariant(status: string) {
		if (status === 'OPEN') return 'warning';
		if (status === 'APPLIED') return 'success';
		return 'neutral';
	}

	function progressText(session: InventoryCountSessionSummary) {
		return `${session.countedLines} de ${session.totalLines} ítems contados`;
	}

	function openCreateModal() {
		formError = '';
		scopeType = 'ALL';
		scopeValue = '';
		notes = '';
		showCreateModal = true;
	}

	async function handleCreateSession() {
		if (!canSubmit || isSubmitting) {
			return;
		}

		isSubmitting = true;
		formError = '';

		try {
			const result = await createSession({
				scopeType,
				scopeValue: scopeType === 'PRODUCT_CATEGORY' && scopeValue !== '' ? scopeValue : null,
				notes: notes.trim() || null
			});

			if (!result.success) {
				formError = result.error ?? 'No se pudo iniciar la sesión';
				toast.error(formError);
				return;
			}

			sessions = [
				result.session,
				...sessions.filter((session) => session.id !== result.session.id)
			];
			showCreateModal = false;
			await goto(resolve(`/inventory/count/${result.session.id}`));
		} catch (error) {
			console.error(error);
			formError = getErrorMessage(error, 'No se pudo iniciar la sesión');
			toast.error(formError);
		} finally {
			isSubmitting = false;
		}
	}

	function goToSession(sessionId: number) {
		goto(resolve(`/inventory/count/${sessionId}`));
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !isSubmitting) {
			showCreateModal = false;
		}
	}
</script>

<svelte:head>
	<title>Conteo Físico - Optikt</title>
</svelte:head>

<div class="space-y-6 p-4 sm:p-6">
	<PageHeader title="Conteo Físico" subtitle="Historial de sesiones de inventario">
		{#snippet actions()}
			{#if activeSession}
				<button
					type="button"
					onclick={() => goToSession(activeSession.id)}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
				>
					<Play class="h-4 w-4" />
					Continuar sesión
				</button>
			{:else}
				<button
					type="button"
					onclick={openCreateModal}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-gold-dark"
				>
					<Plus class="h-4 w-4" />
					Nueva sesión
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if activeSession}
		<section class="glass-card bg-surface-container-low p-5">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="space-y-2">
					<div class="flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-2xl bg-info-container text-on-info-container"
						>
							<ClipboardList class="h-5 w-5" />
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Sesión en progreso
							</p>
							<h2 class="text-lg font-semibold text-brand-navy">
								Iniciada por {activeSession.openedByName ?? 'Usuario'} el
								{formatDate(activeSession.openedAt, { dateStyle: 'medium', timeStyle: 'short' })}
							</h2>
						</div>
					</div>
					<p class="text-sm text-on-surface-variant">
						{formatInventoryCountScope(activeSession.scopeType, activeSession.scopeValue)}
					</p>
					<p class="text-sm font-medium text-brand-navy">{progressText(activeSession)}</p>
				</div>

				<button
					type="button"
					onclick={() => goToSession(activeSession.id)}
					class="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
				>
					Continuar conteo
					<Play class="h-4 w-4" />
				</button>
			</div>
		</section>
	{/if}

	<section class="glass-card bg-surface-container-low p-4 sm:p-5">
		<DataGrid
			{columns}
			items={historySessions}
			page={1}
			perPage={Math.max(historySessions.length, 1)}
			total={historySessions.length}
			totalPages={1}
			itemLabel="sesiones"
			emptyTitle="Sin sesiones registradas"
			emptySubtitle="Inicia el primer conteo físico para comenzar el historial"
			onPageChange={() => {}}
		>
			{#snippet row(session)}
				<tr
					class="bg-surface-container-lowest text-sm text-on-surface transition-colors hover:bg-surface-container-low"
				>
					<td class="px-4 py-3 align-top text-on-surface-variant">
						{formatDate(session.openedAt, { dateStyle: 'medium', timeStyle: 'short' })}
					</td>
					<td class="px-4 py-3 align-top font-medium text-brand-navy">
						{formatInventoryCountScope(session.scopeType, session.scopeValue)}
					</td>
					<td class="px-4 py-3 text-right font-medium">{session.totalLines}</td>
					<td class="px-4 py-3 text-right text-success">{session.totalAdjustmentsIn ?? 0}</td>
					<td class="px-4 py-3 text-right text-error">{session.totalAdjustmentsOut ?? 0}</td>
					<td class="px-4 py-3 text-right">{session.totalMatches ?? 0}</td>
					<td class="px-4 py-3">
						<AppBadge variant={statusVariant(session.status)}>
							{getInventoryCountStatusLabel(session.status)}
						</AppBadge>
					</td>
					<td class="px-4 py-3 text-on-surface-variant">
						{session.appliedByName ?? '—'}
					</td>
					<td class="px-4 py-3 text-right">
						<button
							type="button"
							onclick={() => goToSession(session.id)}
							class="text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
						>
							{session.status === 'OPEN' ? 'Continuar' : 'Ver detalle'}
						</button>
					</td>
				</tr>
			{/snippet}

			{#snippet mobileCard(session)}
				<div class="space-y-3">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								{formatDate(session.openedAt, { dateStyle: 'medium' })}
							</p>
							<p class="mt-1 text-sm font-semibold text-brand-navy">
								{formatInventoryCountScope(session.scopeType, session.scopeValue)}
							</p>
						</div>
						<AppBadge variant={statusVariant(session.status)}>
							{getInventoryCountStatusLabel(session.status)}
						</AppBadge>
					</div>

					<div class="grid grid-cols-3 gap-3 text-sm">
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Ítems
							</p>
							<p class="mt-1 font-semibold text-brand-navy">{session.totalLines}</p>
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Ajustes
							</p>
							<p class="mt-1 font-semibold text-brand-navy">
								+{session.totalAdjustmentsIn ?? 0} / -{session.totalAdjustmentsOut ?? 0}
							</p>
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Sin diff
							</p>
							<p class="mt-1 font-semibold text-brand-navy">{session.totalMatches ?? 0}</p>
						</div>
					</div>

					<button
						type="button"
						onclick={() => goToSession(session.id)}
						class="w-full rounded-xl border border-outline-variant/35 bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
					>
						{session.status === 'OPEN' ? 'Continuar sesión' : 'Ver detalle'}
					</button>
				</div>
			{/snippet}
		</DataGrid>
	</section>

	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4 backdrop-blur-[2px]"
			role="presentation"
			onclick={(event) => {
				if (event.target === event.currentTarget && !isSubmitting) {
					showCreateModal = false;
				}
			}}
			onkeydown={handleModalKeydown}
			tabindex="-1"
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="inventory-count-create-title"
				class="w-full max-w-xl rounded-[1.25rem] border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-xl"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Nuevo conteo
						</p>
						<h2
							id="inventory-count-create-title"
							class="mt-1 text-xl font-semibold text-brand-navy"
						>
							Iniciar sesión
						</h2>
					</div>

					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						disabled={isSubmitting}
						class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-navy"
						aria-label="Cerrar modal"
					>
						<X class="h-4 w-4" />
					</button>
				</div>

				<div class="mt-6 space-y-5">
					<label class="block space-y-2">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
							>Scope</span
						>
						<select
							bind:value={scopeType}
							class="w-full rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface"
						>
							<option value="ALL">Todo el inventario</option>
							<option value="PRODUCT_CATEGORY">Solo productos</option>
							<option value="LENS">Solo lentes en stock</option>
						</select>
					</label>

					{#if scopeType === 'PRODUCT_CATEGORY'}
						<label class="block space-y-2">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
								Categoría
							</span>
							<select
								bind:value={scopeValue}
								class="w-full rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface"
							>
								<option value="">Selecciona una categoría</option>
								{#each ALL_PRODUCT_TYPES as type (type)}
									<option value={type}>{PRODUCT_TYPE_LABELS[type]}</option>
								{/each}
							</select>
						</label>
					{/if}

					<label class="block space-y-2">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
							>Notas</span
						>
						<textarea
							bind:value={notes}
							rows="4"
							class="w-full rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface"
							placeholder="Observaciones opcionales para esta sesión"
						></textarea>
					</label>

					<div
						class="rounded-2xl border border-warning/15 bg-warning-container/40 px-4 py-3 text-sm text-on-surface-variant"
					>
						Se tomará un snapshot del stock actual como referencia. Solo podrá haber una sesión
						activa a la vez.
					</div>

					{#if formError}
						<div
							class="rounded-2xl border border-error/15 bg-error-container px-4 py-3 text-sm text-on-error-container"
						>
							{formError}
						</div>
					{/if}
				</div>

				<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						disabled={isSubmitting}
						class="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
					>
						Cancelar
					</button>
					<button
						type="button"
						onclick={handleCreateSession}
						disabled={!canSubmit || isSubmitting}
						class="rounded-xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? 'Iniciando...' : 'Iniciar sesión'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
