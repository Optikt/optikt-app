CREATE TYPE "public"."sale_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."sale_status";--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "status" SET DATA TYPE "public"."sale_status" USING "status"::"public"."sale_status";