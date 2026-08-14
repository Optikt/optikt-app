ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "od_altura" double precision;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "os_altura" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "od_altura" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "os_altura" double precision;--> statement-breakpoint
ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "altura";--> statement-breakpoint
