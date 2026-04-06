ALTER TABLE "sales" ADD COLUMN "refund_status" varchar(20);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refund_amount" double precision;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refund_notes" varchar(500);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refunded_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_refunded_by_id_fkey" FOREIGN KEY ("refunded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
