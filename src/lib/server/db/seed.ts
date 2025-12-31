import { hash } from '@node-rs/argon2';
import { db } from './index';
import * as table from './schema';
import { eq } from 'drizzle-orm';
import { UserRole } from '$lib/shared/enums';

const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

export async function seedSuperAdmin() {
	const email = 'optikt.vision@gmail.com';
	const username = 'optikt';
	const password = 'SuperAdmin_123';
	const fullName = 'Optikt Admin';

	// Check if superadmin already exists
	const [existingUser] = await db
		.select()
		.from(table.users)
		.where(eq(table.users.email, email))
		.limit(1);

	if (existingUser) {
		console.log('⚠️  Superadmin already exists, skipping seed.');
		return existingUser;
	}

	const hashedPassword = await hash(password, ARGON2_OPTIONS);

	const [user] = await db
		.insert(table.users)
		.values({
			email,
			username: username.toLowerCase(),
			fullName,
			hashedPassword,
			isActive: true,
			isSuperuser: true,
			role: UserRole.SUPERADMIN
		})
		.returning();

	console.log('✅ Superadmin created successfully!');
	console.log(`   Email: ${email}`);
	console.log(`   Username: ${username}`);
	console.log(`   Role: SUPERADMIN`);

	return user;
}
