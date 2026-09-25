<script lang="ts">
	import { Send } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { addSupportTicketCommentCommand } from '$lib/remote/supportTickets.remote';
	import { formatDateOnly, getErrorMessage } from '$lib/utils';
	import type { SupportTicketCommentRow } from '$lib/server/db/queries/supportTickets';

	interface Props {
		ticketId: string;
		comments: SupportTicketCommentRow[];
		currentUserId: string;
		onAdded?: () => void;
	}

	let { ticketId, comments, currentUserId, onAdded }: Props = $props();

	let body = $state('');
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting || !body.trim()) return;

		submitting = true;
		try {
			await addSupportTicketCommentCommand({ ticketId, body });
			body = '';
			toast.success('Comentario agregado');
			onAdded?.();
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo agregar el comentario'));
		} finally {
			submitting = false;
		}
	}
</script>

<section class="glass-card overflow-hidden">
	<div class="border-b border-slate-200 px-4 py-3 sm:px-5">
		<h2 class="text-sm font-semibold text-brand-navy">Seguimiento</h2>
		<p class="mt-0.5 text-xs text-slate-500">
			Anota acuerdos, avances o respuestas para que nada quede en el aire.
		</p>
	</div>

	<div class="space-y-3 px-4 py-4 sm:px-5">
		{#if comments.length === 0}
			<p
				class="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant"
			>
				Sin comentarios todavía.
			</p>
		{:else}
			{#each comments as comment (comment.id)}
				<article
					class={`rounded-xl px-4 py-3 ${comment.authorId === currentUserId ? 'bg-info-container/40' : 'bg-surface-container-low'}`}
				>
					<div class="flex items-center justify-between gap-3">
						<p class="text-xs font-semibold text-brand-navy">
							{comment.authorName ?? 'Usuario'}
							{#if comment.authorId === currentUserId}
								<span class="font-normal text-on-surface-variant">· tú</span>
							{/if}
						</p>
						<p class="text-[11px] text-slate-400">
							{formatDateOnly(comment.createdAt, { dateStyle: 'medium' })}
						</p>
					</div>
					<p class="mt-1.5 text-sm whitespace-pre-wrap text-on-surface">{comment.body}</p>
				</article>
			{/each}
		{/if}
	</div>

	<form onsubmit={handleSubmit} class="border-t border-slate-200 px-4 py-3 sm:px-5">
		<label class="flex flex-col gap-1.5 text-sm">
			<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
				Nuevo comentario
			</span>
			<textarea
				bind:value={body}
				required
				maxlength="2000"
				rows="3"
				class="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				placeholder="Ej: Lo reviso mañana con el proveedor"></textarea>
		</label>
		<div class="mt-2 flex justify-end">
			<button
				type="submit"
				disabled={submitting || !body.trim()}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Send size={15} />
				{submitting ? 'Enviando...' : 'Comentar'}
			</button>
		</div>
	</form>
</section>
