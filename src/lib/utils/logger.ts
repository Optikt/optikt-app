/* eslint-disable no-console -- logger is the only sanctioned console gateway */

type LogContext = Record<string, unknown>;

const IS_DEV = import.meta.env?.DEV === true;

function output(
	method: (message?: unknown, ...optionalParams: unknown[]) => void,
	level: string,
	message: string,
	extras: unknown[]
): void {
	method(`[${level}] ${message}`, ...extras);
}

export const logger = {
	debug(message: string, context?: LogContext): void {
		if (!IS_DEV) return;
		output(console.debug, 'debug', message, context === undefined ? [] : [context]);
	},
	info(message: string, context?: LogContext): void {
		output(console.info, 'info', message, context === undefined ? [] : [context]);
	},
	warn(message: string, context?: LogContext): void {
		output(console.warn, 'warn', message, context === undefined ? [] : [context]);
	},
	error(message: string, error?: unknown, context?: LogContext): void {
		const extras: unknown[] = [];
		if (error !== undefined) extras.push(error);
		if (context !== undefined) extras.push(context);
		output(console.error, 'error', message, extras);
	}
};
