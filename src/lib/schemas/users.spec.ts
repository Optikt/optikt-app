import { describe, it, expect } from 'vitest';
import {
	ListUsersSchema,
	CreateUserSchema,
	UpdateUserSchema,
	UserIdSchema,
	ReactivateUserSchema
} from '$lib/schemas/users';
import { UserRole } from '$lib/shared/enums';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
	return {
		email: 'user@example.com',
		username: 'john_doe',
		fullName: 'John Doe',
		password: 'securepass1',
		role: UserRole.SELLER,
		...overrides
	};
}

// ── ListUsersSchema ─────────────────────────────────────────────────────

describe('ListUsersSchema', () => {
	it('applies pagination defaults', () => {
		const result = ListUsersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.perPage).toBe(10);
			expect(result.data.includeInactive).toBe(false);
		}
	});

	it('accepts role filter', () => {
		const result = ListUsersSchema.safeParse({ role: UserRole.ADMIN });
		expect(result.success).toBe(true);
	});

	it('rejects invalid role', () => {
		const result = ListUsersSchema.safeParse({ role: 'INVALID' });
		expect(result.success).toBe(false);
	});
});

// ── CreateUserSchema ────────────────────────────────────────────────────

describe('CreateUserSchema', () => {
	it('accepts a valid user', () => {
		const result = CreateUserSchema.safeParse(makeUser());
		expect(result.success).toBe(true);
	});

	it('defaults role to VIEWER', () => {
		const { role: _, ...user } = makeUser();
		const result = CreateUserSchema.safeParse(user);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.role).toBe(UserRole.VIEWER);
		}
	});

	it('defaults isActive to true', () => {
		const result = CreateUserSchema.safeParse(makeUser());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isActive).toBe(true);
		}
	});

	it('rejects invalid email', () => {
		const result = CreateUserSchema.safeParse(makeUser({ email: 'bad' }));
		expect(result.success).toBe(false);
	});

	it('rejects email exceeding 255 characters', () => {
		const result = CreateUserSchema.safeParse(
			makeUser({ email: 'a'.repeat(250) + '@b.com' })
		);
		expect(result.success).toBe(false);
	});

	it('rejects username shorter than 3 characters', () => {
		const result = CreateUserSchema.safeParse(makeUser({ username: 'ab' }));
		expect(result.success).toBe(false);
	});

	it('rejects username with special characters', () => {
		const result = CreateUserSchema.safeParse(makeUser({ username: 'user@name' }));
		expect(result.success).toBe(false);
	});

	it('accepts username with underscores', () => {
		const result = CreateUserSchema.safeParse(makeUser({ username: 'john_doe_123' }));
		expect(result.success).toBe(true);
	});

	it('rejects empty fullName', () => {
		const result = CreateUserSchema.safeParse(makeUser({ fullName: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects password shorter than 8 characters', () => {
		const result = CreateUserSchema.safeParse(makeUser({ password: 'short' }));
		expect(result.success).toBe(false);
	});

	it('rejects password longer than 24 characters', () => {
		const result = CreateUserSchema.safeParse(makeUser({ password: 'a'.repeat(25) }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid role', () => {
		const result = CreateUserSchema.safeParse(makeUser({ role: 'INVALID' }));
		expect(result.success).toBe(false);
	});

	it('accepts all valid roles', () => {
		for (const role of Object.values(UserRole)) {
			const result = CreateUserSchema.safeParse(makeUser({ role }));
			expect(result.success).toBe(true);
		}
	});

	it('coerces isActive from string', () => {
		const result = CreateUserSchema.safeParse(makeUser({ isActive: 'false' }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isActive).toBe(false);
		}
	});
});

// ── UpdateUserSchema ────────────────────────────────────────────────────

describe('UpdateUserSchema', () => {
	it('accepts a valid update with id', () => {
		const result = UpdateUserSchema.safeParse({
			id: crypto.randomUUID(),
			fullName: 'Updated Name'
		});
		expect(result.success).toBe(true);
	});

	it('requires a valid UUID for id', () => {
		const result = UpdateUserSchema.safeParse({ id: 'bad' });
		expect(result.success).toBe(false);
	});

	it('accepts empty password (keep current)', () => {
		const result = UpdateUserSchema.safeParse({
			id: crypto.randomUUID(),
			password: ''
		});
		expect(result.success).toBe(true);
	});

	it('accepts valid new password on update', () => {
		const result = UpdateUserSchema.safeParse({
			id: crypto.randomUUID(),
			password: 'newpass12'
		});
		expect(result.success).toBe(true);
	});

	it('rejects short non-empty password on update', () => {
		const result = UpdateUserSchema.safeParse({
			id: crypto.randomUUID(),
			password: 'short'
		});
		expect(result.success).toBe(false);
	});

	it('accepts update with only id', () => {
		const result = UpdateUserSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});
});

// ── UserIdSchema ────────────────────────────────────────────────────────

describe('UserIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = UserIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = UserIdSchema.safeParse({ id: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── ReactivateUserSchema ────────────────────────────────────────────────

describe('ReactivateUserSchema', () => {
	it('accepts a valid reactivation with all fields', () => {
		const result = ReactivateUserSchema.safeParse({
			...makeUser(),
			deletedUserId: crypto.randomUUID()
		});
		expect(result.success).toBe(true);
	});

	it('requires deletedUserId', () => {
		const result = ReactivateUserSchema.safeParse(makeUser());
		expect(result.success).toBe(false);
	});

	it('rejects invalid deletedUserId', () => {
		const result = ReactivateUserSchema.safeParse({
			...makeUser(),
			deletedUserId: 'bad'
		});
		expect(result.success).toBe(false);
	});

	it('requires all CreateUser fields plus deletedUserId', () => {
		const result = ReactivateUserSchema.safeParse({
			deletedUserId: crypto.randomUUID()
		});
		expect(result.success).toBe(false);
	});
});
