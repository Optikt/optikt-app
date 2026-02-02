import { getContext, setContext } from 'svelte';

export type UiConfig = {
	/** Reactive function that returns the current sidebar collapsed state from server */
	sidebarCollapsed: () => boolean;
};

const UI_CONFIG_KEY = Symbol('uiConfig');

/**
 * Set the UI configuration context for child components
 * Call this in the root layout component
 */
export function setUiConfig(config: UiConfig): void {
	setContext(UI_CONFIG_KEY, config);
}

/**
 * Get the UI configuration context
 * Call this in any child component that needs access to UI config
 */
export function getUiConfig(): UiConfig {
	const config = getContext<UiConfig>(UI_CONFIG_KEY);
	if (!config) {
		throw new Error(
			'UiConfig context not found. Make sure setUiConfig is called in a parent component.'
		);
	}
	return config;
}
