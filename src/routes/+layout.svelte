<script lang="ts">
	import './layout.css';
	import { Toaster } from 'svelte-sonner';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage, reportClientError } from '$lib/utils';

	let { children } = $props();

	const CLIENT_ERROR_TOAST_WINDOW_MS = 4000;
	let lastClientErrorToast = '';
	let lastClientErrorAt = 0;

	function toastClientError(message: string) {
		const normalizedMessage = message.trim() || 'Error inesperado en la aplicación';
		const now = Date.now();

		if (
			lastClientErrorToast === normalizedMessage &&
			now - lastClientErrorAt < CLIENT_ERROR_TOAST_WINDOW_MS
		) {
			return;
		}

		lastClientErrorToast = normalizedMessage;
		lastClientErrorAt = now;
		toast.error(normalizedMessage);
	}

	function handleWindowError(event: Event) {
		const errorEvent = event as ErrorEvent;
		const error =
			errorEvent.error ?? new Error(errorEvent.message || 'Error inesperado en la aplicación');

		reportClientError('window.error', error, {
			message: errorEvent.message,
			filename: errorEvent.filename,
			lineno: errorEvent.lineno,
			colno: errorEvent.colno
		});

		toastClientError(
			getErrorMessage(error, errorEvent.message || 'Error inesperado en la aplicación')
		);
	}

	function handleUnhandledRejection(event: Event) {
		const rejectionEvent = event as PromiseRejectionEvent;

		reportClientError('window.unhandledrejection', rejectionEvent.reason);
		toastClientError(getErrorMessage(rejectionEvent.reason, 'Error inesperado en la aplicación'));
	}
</script>

<svelte:window onerror={handleWindowError} onunhandledrejection={handleUnhandledRejection} />
<Toaster position="top-right" expand richColors closeButton />
{@render children()}
