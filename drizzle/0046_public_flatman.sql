CREATE TYPE "public"."support_ticket_activity_kind" AS ENUM('COMMENT', 'CHANGE');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_category" AS ENUM('BUG', 'INCONSISTENCY', 'QUESTION', 'IMPROVEMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_related_type" AS ENUM('SALE', 'CUSTOMER', 'PRODUCT', 'PURCHASES', 'CASH', 'LENSES', 'QUOTES', 'USERS', 'INVENTORY', 'REPORTS', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'SUPPORT_TICKET_CREATED';--> statement-breakpoint
CREATE TABLE "support_ticket_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" "support_ticket_activity_kind" DEFAULT 'COMMENT' NOT NULL,
	"body" varchar,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"title" varchar NOT NULL,
	"description" varchar NOT NULL,
	"category" "support_ticket_category" DEFAULT 'BUG' NOT NULL,
	"priority" "support_ticket_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "support_ticket_status" DEFAULT 'OPEN' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"related_type" "support_ticket_related_type",
	"related_label" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_ticket_activity" ADD CONSTRAINT "support_ticket_activity_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activity" ADD CONSTRAINT "support_ticket_activity_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_support_ticket_activity_ticket_id" ON "support_ticket_activity" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_support_tickets_number" ON "support_tickets" USING btree ("number");--> statement-breakpoint
CREATE INDEX "ix_support_tickets_status_created_at" ON "support_tickets" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ix_support_tickets_created_by_id" ON "support_tickets" USING btree ("created_by_id");