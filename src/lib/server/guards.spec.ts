import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '$lib/shared/enums';

// Mock $app/server
const mockGetRequestEvent = vi.fn();
vi.mock('$app/server', () => ({
	getRequestEvent: () => mockGetRequestEvent()
}));

// Capture HttpError throws from @sveltejs/kit error()
class HttpError {
	constructor(
		public status: number,
		public body: { message: string }
	) {}
}

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		throw new HttpError(status, { message });
	}
}));

import {
	getCurrentUser,
	getCurrentSession,
	requireAuth,
	requireRole,
	requireAdmin,
	requireSuperuser
} from './guards';

function makeUser(overrides: Record<string, unknown> = {}) {
	return {
		id: 'user-1',
		username: 'testuser',
		email: 'test@example.com',
		fullName: 'Test User',
		role: UserRole.VIEWER,
		isActive: true,
		isSuperuser: false,
		...overrides
	};
}

describe('guards', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getCurrentUser', () => {
		it('returns the user from locals', () => {
			const user = makeUser();
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(getCurrentUser()).toBe(user);
		});

		it('returns undefined when no user in locals', () => {
			mockGetRequestEvent.mockReturnValue({ locals: {} });
			expect(getCurrentUser()).toBeUndefined();
		});
	});

	describe('getCurrentSession', () => {
		it('returns the session from locals', () => {
			const session = { id: 'session-1', userId: 'user-1' };
			mockGetRequestEvent.mockReturnValue({ locals: { session } });
			expect(getCurrentSession()).toBe(session);
		});

		it('returns undefined when no session in locals', () => {
			mockGetRequestEvent.mockReturnValue({ locals: {} });
			expect(getCurrentSession()).toBeUndefined();
		});
	});

	describe('requireAuth', () => {
		it('returns user when authenticated', () => {
			const user = makeUser();
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireAuth()).toBe(user);
		});

		it('throws 401 when user is null', () => {
			mockGetRequestEvent.mockReturnValue({ locals: { user: null } });
			expect(() => requireAuth()).toThrow(HttpError);
			try {
				requireAuth();
			} catch (e) {
				expect((e as HttpError).status).toBe(401);
			}
		});

		it('throws 401 when user is undefined', () => {
			mockGetRequestEvent.mockReturnValue({ locals: {} });
			expect(() => requireAuth()).toThrow(HttpError);
		});
	});

	describe('requireRole', () => {
		it('returns user when role matches', () => {
			const user = makeUser({ role: UserRole.ADMIN });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireRole(UserRole.ADMIN)).toBe(user);
		});

		it('returns user when role is in allowed list', () => {
			const user = makeUser({ role: UserRole.MANAGER });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireRole(UserRole.ADMIN, UserRole.MANAGER)).toBe(user);
		});

		it('throws 403 when role does not match', () => {
			const user = makeUser({ role: UserRole.VIEWER });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(() => requireRole(UserRole.ADMIN)).toThrow(HttpError);
			try {
				requireRole(UserRole.ADMIN);
			} catch (e) {
				expect((e as HttpError).status).toBe(403);
			}
		});

		it('throws 401 when not authenticated', () => {
			mockGetRequestEvent.mockReturnValue({ locals: {} });
			expect(() => requireRole(UserRole.ADMIN)).toThrow(HttpError);
			try {
				requireRole(UserRole.ADMIN);
			} catch (e) {
				expect((e as HttpError).status).toBe(401);
			}
		});
	});

	describe('requireAdmin', () => {
		it('returns SUPERADMIN user', () => {
			const user = makeUser({ role: UserRole.SUPERADMIN });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireAdmin()).toBe(user);
		});

		it('returns ADMIN user', () => {
			const user = makeUser({ role: UserRole.ADMIN });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireAdmin()).toBe(user);
		});

		it('returns MANAGER user', () => {
			const user = makeUser({ role: UserRole.MANAGER });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireAdmin()).toBe(user);
		});

		it('throws 403 for SELLER', () => {
			const user = makeUser({ role: UserRole.SELLER });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(() => requireAdmin()).toThrow(HttpError);
		});

		it('throws 403 for VIEWER', () => {
			const user = makeUser({ role: UserRole.VIEWER });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(() => requireAdmin()).toThrow(HttpError);
		});
	});

	describe('requireSuperuser', () => {
		it('returns superuser', () => {
			const user = makeUser({ isSuperuser: true });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(requireSuperuser()).toBe(user);
		});

		it('throws 403 when not superuser', () => {
			const user = makeUser({ isSuperuser: false });
			mockGetRequestEvent.mockReturnValue({ locals: { user } });
			expect(() => requireSuperuser()).toThrow(HttpError);
			try {
				requireSuperuser();
			} catch (e) {
				expect((e as HttpError).status).toBe(403);
			}
		});

		it('throws 401 when not authenticated', () => {
			mockGetRequestEvent.mockReturnValue({ locals: {} });
			expect(() => requireSuperuser()).toThrow(HttpError);
			try {
				requireSuperuser();
			} catch (e) {
				expect((e as HttpError).status).toBe(401);
			}
		});
	});
});
