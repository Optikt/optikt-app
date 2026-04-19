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

export async function seedAdmin() {
	const email = 'optikt.vision@gmail.com';
	const username = 'optikt';
	const password = 'Admin_123';
	const fullName = 'Optikt Admin';

	// Check if admin already exists
	const [existingUser] = await db
		.select()
		.from(table.users)
		.where(eq(table.users.email, email))
		.limit(1);

	if (existingUser) {
		console.log('⚠️ Aadmin already exists, skipping seed.');
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
			role: UserRole.ADMIN
		})
		.returning();

	console.log('✅ Admin created successfully!');
	console.log(`   Email: ${email}`);
	console.log(`   Username: ${username}`);
	console.log(`   Role: ADMIN`);

	return user;
}
