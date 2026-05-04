CREATE TABLE "inventory_count_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"item_type" varchar NOT NULL,
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"system_stock" integer NOT NULL,
	"counted_stock" integer,
	"difference" integer,
	"counted_by_id" uuid,
	"counted_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_count_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar NOT NULL,
	"scope_type" varchar NOT NULL,
	"scope_value" varchar,
	"notes" text,
	"opened_by_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_by_id" uuid,
	"applied_at" timestamp with time zone,
	"cancelled_by_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"total_items_counted" integer,
	"total_adjustments_in" integer,
	"total_adjustments_out" integer,
	"total_matches" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD CONSTRAINT "inventory_count_sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_inventory_count_lines_id" ON "inventory_count_lines" USING btree ("id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_count_lines_session_item_type" ON "inventory_count_lines" USING btree ("session_id" int4_ops,"item_type");--> statement-breakpoint
CREATE INDEX "ix_inventory_count_lines_session_product_id" ON "inventory_count_lines" USING btree ("session_id" int4_ops,"product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_count_lines_session_lens_id" ON "inventory_count_lines" USING btree ("session_id" int4_ops,"lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_count_sessions_id" ON "inventory_count_sessions" USING btree ("id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_count_sessions_status" ON "inventory_count_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_count_sessions_open" ON "inventory_count_sessions" USING btree ("status") WHERE "inventory_count_sessions"."status" = 'OPEN';