-- RT-5: Backfill NULL payment_date and add NOT NULL constraint
UPDATE "sale_payments" SET "payment_date" = "created_at" WHERE "payment_date" IS NULL;
--> statement-breakpoint
ALTER TABLE "sale_payments" ALTER COLUMN "payment_date" SET NOT NULL;
