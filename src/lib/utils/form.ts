/**
 * Form utility functions
 */

/**
 * Scrolls to the first form input with an error.
 * Finds the first element with Flowbite's error border styling and scrolls to it.
 * Useful for long forms where errors may be off-screen after submission.
 */
export function scrollToFirstError(): void {
	// Wait for DOM to update with error styles
	setTimeout(() => {
		// Find first input/textarea with error (Flowbite uses border-red-500 for error inputs)
		const firstError = document.querySelector(
			'.border-red-500, [class*="border-red"]'
		) as HTMLElement | null;

		if (firstError) {
			firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
			firstError.focus();
		}
	}, 50);
}
