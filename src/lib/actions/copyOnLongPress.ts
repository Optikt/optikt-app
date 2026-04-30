export interface CopyOnLongPressOptions {
	text?: string | null;
	delay?: number;
	onCopied?: (text: string) => void;
	onError?: (error: unknown) => void;
}

const DEFAULT_DELAY = 1500;

export function copyOnLongPress(node: HTMLElement, options: CopyOnLongPressOptions) {
	let settings = options;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let activePointerId: number | null = null;

	function clearPendingCopy() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = undefined;
		}
		activePointerId = null;
	}

	async function commitCopy() {
		const text = settings.text?.trim();
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
			settings.onCopied?.(text);
		} catch (error) {
			settings.onError?.(error);
		}
	}

	function handlePointerDown(event: PointerEvent) {
		const text = settings.text?.trim();
		if (!text) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;

		clearPendingCopy();
		activePointerId = event.pointerId;
		timeoutId = setTimeout(() => {
			void commitCopy();
			clearPendingCopy();
		}, settings.delay ?? DEFAULT_DELAY);
	}

	function handlePointerEnd(event: PointerEvent) {
		if (activePointerId !== null && event.pointerId !== activePointerId) return;
		clearPendingCopy();
	}

	function handleContextMenu(event: Event) {
		event.preventDefault();
	}

	node.addEventListener('pointerdown', handlePointerDown);
	node.addEventListener('pointerup', handlePointerEnd);
	node.addEventListener('pointerleave', handlePointerEnd);
	node.addEventListener('pointercancel', handlePointerEnd);
	node.addEventListener('contextmenu', handleContextMenu);

	return {
		update(nextOptions: CopyOnLongPressOptions) {
			settings = nextOptions;
		},
		destroy() {
			clearPendingCopy();
			node.removeEventListener('pointerdown', handlePointerDown);
			node.removeEventListener('pointerup', handlePointerEnd);
			node.removeEventListener('pointerleave', handlePointerEnd);
			node.removeEventListener('pointercancel', handlePointerEnd);
			node.removeEventListener('contextmenu', handleContextMenu);
		}
	};
}
