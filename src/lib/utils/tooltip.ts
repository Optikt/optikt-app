/**
 * Helper para el formato de tooltip usado por el mockup: `Título|Cuerpo`.
 * TriggerTooltip recibe `title` y `text` por separado — nunca parsea pipes.
 */
export function splitTooltip(tip: string | undefined): {
	title?: string;
	text?: string;
} {
	if (!tip) return {};
	const separator = tip.indexOf('|');
	if (separator < 0) return { text: tip };
	const title = tip.slice(0, separator).trim();
	const text = tip.slice(separator + 1).trim();
	return {
		...(title ? { title } : {}),
		...(text ? { text } : {})
	};
}
