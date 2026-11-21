CREATE TABLE "sale_item_group_members" (
	"group_id" uuid NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "sale_item_group_members_group_id_sale_item_id_pk" PRIMARY KEY("group_id","sale_item_id"),
	CONSTRAINT "sale_item_group_members_quantity_positive" CHECK ("sale_item_group_members"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "sale_item_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"label" varchar(60),
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_item_group_members" (
	"group_id" uuid NOT NULL,
	"quote_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "quote_item_group_members_group_id_quote_item_id_pk" PRIMARY KEY("group_id","quote_item_id"),
	CONSTRAINT "quote_item_group_members_quantity_positive" CHECK ("quote_item_group_members"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "quote_item_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"label" varchar(60),
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "primary_lens_item_id" uuid;--> statement-breakpoint
ALTER TABLE "sale_item_group_members" ADD CONSTRAINT "sale_item_group_members_group_id_sale_item_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sale_item_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_group_members" ADD CONSTRAINT "sale_item_group_members_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_groups" ADD CONSTRAINT "sale_item_groups_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item_group_members" ADD CONSTRAINT "quote_item_group_members_group_id_quote_item_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."quote_item_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item_group_members" ADD CONSTRAINT "quote_item_group_members_quote_item_id_quote_items_id_fk" FOREIGN KEY ("quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item_groups" ADD CONSTRAINT "quote_item_groups_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_sale_item_group_members_sale_item_id" ON "sale_item_group_members" USING btree ("sale_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_item_groups_sale_id" ON "sale_item_groups" USING btree ("sale_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_item_group_members_quote_item_id" ON "quote_item_group_members" USING btree ("quote_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_item_groups_quote_id" ON "quote_item_groups" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_primary_lens_item_id_sale_items_id_fk" FOREIGN KEY ("primary_lens_item_id") REFERENCES "public"."sale_items"("id") ON DELETE set null ON UPDATE no action;