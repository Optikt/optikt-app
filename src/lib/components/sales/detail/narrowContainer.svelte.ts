/**
 * Tracks whether a page container is narrower than `threshold` px with a
 * ResizeObserver (not a viewport query), so the sidebar open/close reflow
 * drives the switch. Shared by the sale and quote detail pages.
 */
export class NarrowContainer {
	narrow = $state(false);

	constructor(private readonly threshold = 700) {}

	/** Use as `{@attach container.attach}` on the page element. */
	attach = (node: HTMLElement) => {
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width !== undefined) this.narrow = width < this.threshold;
		});
		observer.observe(node);
		return () => observer.disconnect();
	};
}
