import { describe, it, expect } from 'vitest';
import { SearchScope, SEARCH_SCOPE_PREFIXES, SEARCH_SCOPE_LABELS } from './search';

const ALL_SEARCH_SCOPES = Object.values(SearchScope) as SearchScope[];

describe('SearchScope enum', () => {
	it('has all expected values', () => {
		expect(SearchScope.GLOBAL).toBe('GLOBAL');
		expect(SearchScope.DOCUMENT).toBe('DOCUMENT');
		expect(SearchScope.CUSTOMER).toBe('CUSTOMER');
		expect(SearchScope.PRODUCT).toBe('PRODUCT');
		expect(SearchScope.LENS).toBe('LENS');
		expect(SearchScope.PROVIDER_OR_BRAND).toBe('PROVIDER_OR_BRAND');
	});

	it('contains exactly 6 scopes', () => {
		expect(ALL_SEARCH_SCOPES).toHaveLength(6);
	});
});

describe('SEARCH_SCOPE_PREFIXES', () => {
	it('has a prefix entry for every scope', () => {
		for (const scope of ALL_SEARCH_SCOPES) {
			expect(scope in SEARCH_SCOPE_PREFIXES).toBe(true);
		}
	});

	it('GLOBAL has null prefix (no prefix needed)', () => {
		expect(SEARCH_SCOPE_PREFIXES[SearchScope.GLOBAL]).toBeNull();
	});

	it('non-GLOBAL scopes have string prefixes', () => {
		expect(SEARCH_SCOPE_PREFIXES[SearchScope.DOCUMENT]).toBe('#');
		expect(SEARCH_SCOPE_PREFIXES[SearchScope.CUSTOMER]).toBe('@');
		expect(SEARCH_SCOPE_PREFIXES[SearchScope.PRODUCT]).toBe('!');
		expect(SEARCH_SCOPE_PREFIXES[SearchScope.LENS]).toBe('*');
		expect(SEARCH_SCOPE_PREFIXES[SearchScope.PROVIDER_OR_BRAND]).toBe('%');
	});

	it('all non-GLOBAL prefixes are unique single characters', () => {
		const prefixes = ALL_SEARCH_SCOPES
			.filter((s) => s !== SearchScope.GLOBAL)
			.map((s) => SEARCH_SCOPE_PREFIXES[s]);

		for (const p of prefixes) {
			expect(typeof p).toBe('string');
			expect(p).toHaveLength(1);
		}

		const unique = new Set(prefixes);
		expect(unique.size).toBe(prefixes.length);
	});
});

describe('SEARCH_SCOPE_LABELS', () => {
	it('has a label for every scope', () => {
		for (const scope of ALL_SEARCH_SCOPES) {
			expect(SEARCH_SCOPE_LABELS[scope]).toBeDefined();
		}
	});

	it('returns correct Spanish labels', () => {
		expect(SEARCH_SCOPE_LABELS[SearchScope.GLOBAL]).toBe('Global');
		expect(SEARCH_SCOPE_LABELS[SearchScope.DOCUMENT]).toBe('Documentos');
		expect(SEARCH_SCOPE_LABELS[SearchScope.CUSTOMER]).toBe('Pacientes');
		expect(SEARCH_SCOPE_LABELS[SearchScope.PRODUCT]).toBe('Productos');
		expect(SEARCH_SCOPE_LABELS[SearchScope.LENS]).toBe('Cristales');
		expect(SEARCH_SCOPE_LABELS[SearchScope.PROVIDER_OR_BRAND]).toBe('Proveedores y marcas');
	});

	it('all labels are non-empty strings', () => {
		for (const scope of ALL_SEARCH_SCOPES) {
			expect(SEARCH_SCOPE_LABELS[scope].length).toBeGreaterThan(0);
		}
	});
});
