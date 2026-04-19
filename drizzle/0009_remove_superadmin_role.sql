-- Migration: Remove SUPERADMIN role
-- Convert all SUPERADMIN users to ADMIN
UPDATE users SET role = 'ADMIN' WHERE role = 'SUPERADMIN';
