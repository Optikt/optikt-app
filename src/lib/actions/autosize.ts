export interface AutosizeOptions {
	/** Minimum visible rows, even when empty. */
	minRows?: number;
	/** Rows shown before the textarea starts scrolling internally. */
	maxRows?: number;
}

const DEFAULT_LINE_HEIGHT = 20;

/**
 * Grows a textarea with its content, between `minRows` and `maxRows`.
 * Past `maxRows` the textarea scrolls instead of growing further.
 */
export function autosize(node: HTMLTextAreaElement, options: AutosizeOptions = {}) {
	let settings = { minRows: 1, maxRows: 4, ...options };

	function resize() {
		const style = getComputedStyle(node);
		const lineHeight =
			parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4 || DEFAULT_LINE_HEIGHT;
		const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
		const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

		node.style.height = 'auto';
		const contentHeight = Math.max(
			node.scrollHeight - paddingY - borders,
			lineHeight * settings.minRows
		);
		const maxHeight = lineHeight * settings.maxRows;

		node.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
		node.style.height = `${Math.min(contentHeight, maxHeight) + paddingY + borders}px`;
	}

	node.addEventListener('input', resize);
	resize();

	return {
		update(nextOptions: AutosizeOptions) {
			settings = { ...settings, ...nextOptions };
			resize();
		},
		destroy() {
			node.removeEventListener('input', resize);
		}
	};
}
