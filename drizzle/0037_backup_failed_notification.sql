-- Add BACKUP_FAILED to the notification_type enum.
-- NOTE: idempotent on purpose — mirrors the pattern used in 0034/0035 for enum additions.
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		WHERE t.typname = 'notification_type' AND e.enumlabel = 'BACKUP_FAILED'
	) THEN
		ALTER TYPE "public"."notification_type" ADD VALUE 'BACKUP_FAILED';
	END IF;
END $$;
