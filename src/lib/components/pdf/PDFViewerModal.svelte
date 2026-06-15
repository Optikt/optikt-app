<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		X,
		ChevronLeft,
		ChevronRight,
		Download,
		ZoomIn,
		ZoomOut,
		Maximize,
		Minimize,
		Printer
	} from '@lucide/svelte';

	interface Props {
		url: string;
		title?: string;
		fileName?: string;
		onClose: () => void;
	}

	let { url, title = 'Vista previa', fileName = 'documento.pdf', onClose }: Props = $props();

	let container: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let pdfSlick: any = $state(null);
	let pageNumber = $state(1);
	let numPages = $state(0);
	let scale = $state(1);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let unsub: (() => void) | null = null;

	onMount(async () => {
		if (!url) {
			loading = false;
			error = 'No se especificó URL del documento';
			return;
		}
		try {
			const [{ default: workerUrl }, { GlobalWorkerOptions }] = await Promise.all([
				import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
				import('pdfjs-dist')
			]);
			GlobalWorkerOptions.workerSrc = workerUrl;

			const mod = await import('@pdfslick/core');
			import('@pdfslick/core/dist/pdf_viewer.css');

			const store = mod.create();
			const instance = new mod.PDFSlick({
				container,
				store,
				options: {
					scaleValue: '1',
					l10n: {
						get: async (_id: string, _args: unknown, fallback: string) => fallback,
						pause: async () => {},
						resume: async () => {}
					}
				}
			});
			instance.loadDocument(url);
			store.setState({ pdfSlick: instance });
			unsub = store.subscribe(
				(s: { pageNumber: number; numPages: number; scale: number }) => {
					pageNumber = s.pageNumber;
					numPages = s.numPages;
					scale = s.scale;
				}
			);
			pdfSlick = instance;
			loading = false;
		} catch (e) {
			console.error('Error initializing PDF viewer:', e);
			error = 'Error al cargar el PDF';
			loading = false;
		}
	});

	onDestroy(() => {
		unsub?.();
		if (pdfSlick) {
			try {
				pdfSlick.unbindEvents();
				pdfSlick._cleanup();
			} catch (e) {
				console.warn('PDFSlick cleanup error:', e);
			}
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	function zoomIn() {
		pdfSlick?.increaseScale();
	}

	function zoomOut() {
		pdfSlick?.decreaseScale();
	}

	function zoomPageWidth() {
		if (pdfSlick) {
			pdfSlick.currentScaleValue = 'page-width';
		}
	}

	function zoomPageFit() {
		if (pdfSlick) {
			pdfSlick.currentScaleValue = 'page-fit';
		}
	}

	function zoomActual() {
		if (pdfSlick) {
			pdfSlick.currentScale = 1;
		}
	}

	function print() {
		window.open(url, '_blank', 'noopener,noreferrer');
		onClose();
	}

	function download() {
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
	}

	const scalePercent = $derived(Math.round(scale * 100));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
	onkeydown={handleKeydown}
	onclick={handleBackdropClick}
>
	<div
		role="dialog"
		aria-modal="true"
		class="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		style="height: 88vh;"
	>
		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
			<div class="min-w-0">
				<h2 class="truncate text-sm font-semibold text-brand-navy">{title}</h2>
				<p class="mt-0.5 text-[11px] text-slate-400">
					{loading ? 'Preparando documento…' : error ?? `${pageNumber} / ${numPages}`}
				</p>
			</div>
			<div class="flex items-center gap-1.5">
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
					onclick={onClose}
					title="Cerrar"
				>
					<X size={18} />
				</button>
			</div>
		</div>

		<!-- Body -->
		<div class="relative min-h-0 flex-1 bg-slate-200/70">
			{#if loading}
				<div class="flex h-full items-center justify-center">
					<div class="flex flex-col items-center gap-3">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-brand-blue"
						></div>
						<p class="text-sm text-slate-500">Generando PDF…</p>
					</div>
				</div>
			{:else if error}
				<div class="flex h-full items-center justify-center">
					<p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
				</div>
			{/if}

			<div
				class="pdfSlickContainer absolute inset-0 overflow-auto"
				class:invisible={loading || !!error}
				bind:this={container}
			>
				<div class="pdfSlickViewer pdfViewer"></div>
			</div>
		</div>

		<!-- Footer toolbar -->
		<div
			class="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5"
		>
			<!-- Zoom controls -->
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
					onclick={zoomOut}
					disabled={loading || !!error || !pdfSlick}
					title="Alejar"
				>
					<ZoomOut size={16} />
				</button>
				<button
					type="button"
					class="inline-flex h-7 min-w-[4.5rem] items-center justify-center rounded-md px-2 font-mono text-xs font-medium text-slate-600 transition-colors hover:bg-white"
					onclick={zoomActual}
					disabled={loading || !!error || !pdfSlick}
					title="100%"
				>
					{scalePercent}%
				</button>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
					onclick={zoomIn}
					disabled={loading || !!error || !pdfSlick}
					title="Acercar"
				>
					<ZoomIn size={16} />
				</button>
				<span class="mx-1 h-5 w-px bg-slate-200"></span>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
					onclick={zoomPageWidth}
					disabled={loading || !!error || !pdfSlick}
					title="Ancho de página"
				>
					<Minimize size={14} />
				</button>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
					onclick={zoomPageFit}
					disabled={loading || !!error || !pdfSlick}
					title="Ajustar a la página"
				>
					<Maximize size={14} />
				</button>
			</div>

			<!-- Page navigation -->
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
					onclick={() => pdfSlick?.gotoPage(Math.max(pageNumber - 1, 1))}
					disabled={pageNumber <= 1 || loading || !!error || !pdfSlick}
				>
					<ChevronLeft size={16} />
				</button>
				<span class="min-w-[4.5rem] text-center font-mono text-xs font-medium text-slate-600">
					{numPages > 0 ? `${pageNumber} / ${numPages}` : '–'}
				</span>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
					onclick={() => pdfSlick?.gotoPage(Math.min(pageNumber + 1, numPages))}
					disabled={pageNumber >= numPages || loading || !!error || !pdfSlick}
				>
					<ChevronRight size={16} />
				</button>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-1.5">
				<button
					type="button"
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
					onclick={print}
					disabled={loading || !!error || !pdfSlick}
				>
					<Printer size={14} />
					Imprimir
				</button>
				<button
					type="button"
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-blue-dark"
					onclick={download}
				>
					<Download size={14} />
					Descargar
				</button>
			</div>
		</div>
	</div>
</div>
