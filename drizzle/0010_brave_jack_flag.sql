ALTER TABLE "inventory_count_lines" ADD COLUMN IF NOT EXISTS "adjustment_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN IF NOT EXISTS "adjustment_completed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN IF NOT EXISTS "adjustment_completed_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_adjustment_completed_by_id_fkey" FOREIGN KEY ("adjustment_completed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;