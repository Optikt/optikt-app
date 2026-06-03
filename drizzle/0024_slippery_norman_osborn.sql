CREATE TYPE "public"."notification_severity" AS ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('STOCK_LOW', 'BACKUP_CREATED', 'RATE_UPDATED', 'RATE_OUTDATED');--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reads_pkey" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"severity" "notification_severity" DEFAULT 'INFO' NOT NULL,
	"title" varchar NOT NULL,
	"body" varchar,
	"metadata" jsonb,
	"target_roles" varchar[] DEFAULT ARRAY[]::text[] NOT NULL,
	"link" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "exchange_rates" CASCADE;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_notification_reads_user_id" ON "notification_reads" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_notification_reads_read_at" ON "notification_reads" USING btree ("read_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "ix_notifications_created_at" ON "notifications" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "ix_notifications_type" ON "notifications" USING btree ("type");