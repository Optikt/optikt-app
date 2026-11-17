ALTER TABLE "sale_payments" ADD COLUMN "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD COLUMN "voided_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD COLUMN "void_reason" varchar(500);