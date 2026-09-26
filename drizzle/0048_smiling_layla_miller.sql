CREATE TYPE "public"."support_ticket_activity_kind" AS ENUM('COMMENT', 'CHANGE');--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ADD COLUMN "kind" "support_ticket_activity_kind" DEFAULT 'COMMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ADD COLUMN "metadata" jsonb;