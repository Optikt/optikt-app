import { describe, expect, it } from 'vitest';
import { quoteRowActions, QUOTE_ROW_ACTION_ICONS } from './quoteRowActions';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

const ids = (status: string, canManage: boolean) =>
	quoteRowActions({ status }, canManage).map((a) => a.id);

describe('quoteRowActions', () => {
	it('borrador gestionable: todas, cancelar al final y destructiva', () => {
		const actions = quoteRowActions({ status: QuoteStatus.DRAFT }, true);
		expect(actions.map((a) => a.id)).toEqual(['detail', 'edit', 'convert', 'duplicate', 'cancel']);
		expect(actions.at(-1)?.danger).toBe(true);
	});

	it('convertido/cancelado: solo ver y duplicar (D7)', () => {
		expect(ids(QuoteStatus.CONVERTED, true)).toEqual(['detail', 'duplicate']);
		expect(ids(QuoteStatus.CANCELLED, true)).toEqual(['detail', 'duplicate']);
	});

	it('sin permiso (VIEWER): solo ver detalle', () => {
		expect(ids(QuoteStatus.DRAFT, false)).toEqual(['detail']);
	});

	it('cada acción tiene icono', () => {
		for (const action of quoteRowActions({ status: QuoteStatus.DRAFT }, true)) {
			expect(QUOTE_ROW_ACTION_ICONS[action.id]).toBeTruthy();
		}
	});
});
