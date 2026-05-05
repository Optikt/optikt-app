type SuggestibleOption = {
	id: string;
	isPending?: boolean;
};

export function sortOptionsBySuggested<T extends SuggestibleOption>(
	options: T[],
	suggestedIds: string[]
): T[] {
	const persistedOptions = options.filter((option) => !option.isPending);
	const pendingOptions = options.filter((option) => option.isPending);

	if (suggestedIds.length === 0) {
		return [...persistedOptions, ...pendingOptions];
	}

	const suggestedSet = new Set(suggestedIds);
	const suggestedOptions = persistedOptions.filter((option) => suggestedSet.has(option.id));
	const otherOptions = persistedOptions.filter((option) => !suggestedSet.has(option.id));

	return [...suggestedOptions, ...otherOptions, ...pendingOptions];
}
