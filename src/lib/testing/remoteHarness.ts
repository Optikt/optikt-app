import { with_request_store } from '@sveltejs/kit/internal/server';
import type { User } from '$lib/server/db/schema';
import { buildValidationMessage, type ValidationIssue } from '$lib/utils/validationError';

export type SessionUser = Pick<User, 'id' | 'role'> & Partial<User>;

export interface CallRemoteOptions {
	user?: SessionUser | null;
	method?: string;
	url?: string;
}

function createTestStore(options: CallRemoteOptions = {}) {
	const { user = null, method = 'POST', url = 'http://localhost/test' } = options;
	const request = new Request(url, { method, headers: { 'user-agent': 'vitest' } });
	const parsedUrl = new URL(url);

	const event = {
		cookies: {
			get: () => undefined,
			getAll: () => [],
			set: () => {},
			delete: () => {},
			serialize: () => ''
		},
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		locals: { user, session: null },
		params: {},
		platform: undefined,
		request,
		route: { id: '/test' },
		setHeaders: () => {},
		url: parsedUrl,
		isDataRequest: false,
		isRemoteRequest: false
	};

	const state = {
		prerendering: undefined,
		transport: {},
		handleValidationError: ({ issues }: { issues: ValidationIssue[] }) => ({
			message: buildValidationMessage(issues)
		}),
		tracing: {
			record_span: (fn: (span: unknown) => unknown) => fn(undefined)
		},
		remote: {
			data: null,
			explicit: null,
			implicit: null,
			forms: null,
			requested: null,
			batches: null,
			live_iterators: null
		},
		is_in_remote_function: false,
		is_in_remote_form_or_command: false,
		is_in_remote_query: false,
		is_in_render: false,
		is_in_universal_load: false
	};

	return { event, state };
}

export async function callRemote<A, T = unknown>(
	fn: (arg: A) => unknown,
	arg: A,
	options: CallRemoteOptions = {}
): Promise<T> {
	const store = createTestStore(options);
	const result = with_request_store(store, () => fn(arg));
	return (await result) as T;
}

interface RemoteFormInternals {
	__: {
		fn: (data: unknown, meta: unknown, formData: FormData | null) => Promise<unknown>;
	};
}

/**
 * Call a remote `form()` function server-side.
 *
 * The exported form instance is not directly callable (it only exposes
 * `for`/`enhance`/`fields`), so tests must go through the internal `__` handler
 * that Kit itself runs on submission.
 */
export async function callRemoteForm<A, T = unknown>(
	remoteForm: unknown,
	data: A,
	options: CallRemoteOptions = {}
): Promise<T> {
	const internals = (remoteForm as RemoteFormInternals).__;
	if (!internals?.fn) {
		throw new Error('callRemoteForm: argument is not a remote form instance');
	}

	const store = createTestStore(options);
	const output = (await with_request_store(store, () => internals.fn(data, {}, null))) as {
		result?: T;
		issues?: unknown[];
	};

	if (output.issues?.length) {
		throw new Error(`Remote form validation failed: ${JSON.stringify(output.issues)}`);
	}

	return output.result as T;
}
