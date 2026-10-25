export interface AutosizeOptions {
	/** Minimum visible rows, even when empty. */
	minRows?: number;
	/** Rows shown before the textarea starts scrolling internally. */
	maxRows?: number;
}

const DEFAULT_LINE_HEIGHT = 20;

/**
 * Grows a textarea with its content, between `minRows` and `maxRows` rows.
 * Past `maxRows` the textarea scrolls instead of growing further.
 * Call it after the DOM value changes (mount, input, programmatic updates).
 */
export function resizeAutosize(node: HTMLTextAreaElement, options: AutosizeOptions = {}) {
	const minRows = options.minRows ?? 1;
	const maxRows = options.maxRows ?? 4;

	const style = getComputedStyle(node);
	const lineHeight =
		parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4 || DEFAULT_LINE_HEIGHT;
	const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
	const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

	node.style.height = 'auto';
	const contentHeight = Math.max(node.scrollHeight - paddingY, lineHeight * minRows);
	const maxHeight = lineHeight * maxRows;

	node.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
	node.style.height = `${Math.min(contentHeight, maxHeight) + paddingY + borders}px`;
}
