CREATE TABLE "purchase_order_early_payment_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"payment_id" uuid,
	"benefit_date" date NOT NULL,
	"amount_usd_bcv" double precision NOT NULL,
	"applied_to_balance" boolean DEFAULT true NOT NULL,
	"note" varchar,
	"created_by_id" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "credit_due_date" date;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "early_payment_discount_percent" double precision;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "early_payment_discount_deadline" date;--> statement-breakpoint
UPDATE "purchase_orders" AS po
SET
	"credit_due_date" = schedule_terms."credit_due_date",
	"early_payment_discount_percent" = schedule_terms."early_payment_discount_percent",
	"early_payment_discount_deadline" = schedule_terms."early_payment_discount_deadline"
FROM (
	SELECT
		"purchase_order_id",
		max("due_date") AS "credit_due_date",
		(
			array_agg(
				"early_payment_discount_percent"
				ORDER BY "early_payment_discount_deadline" ASC NULLS LAST, "installment_number" ASC
			) FILTER (
				WHERE "early_payment_discount_percent" IS NOT NULL
					AND "early_payment_discount_percent" > 0
					AND "early_payment_discount_deadline" IS NOT NULL
			)
		)[1] AS "early_payment_discount_percent",
		(
			array_agg(
				"early_payment_discount_deadline"
				ORDER BY "early_payment_discount_deadline" ASC NULLS LAST, "installment_number" ASC
			) FILTER (
				WHERE "early_payment_discount_percent" IS NOT NULL
					AND "early_payment_discount_percent" > 0
					AND "early_payment_discount_deadline" IS NOT NULL
			)
		)[1] AS "early_payment_discount_deadline"
	FROM "purchase_order_credit_schedule"
	GROUP BY "purchase_order_id"
) AS schedule_terms
WHERE po."id" = schedule_terms."purchase_order_id";--> statement-breakpoint
DROP TABLE "purchase_order_credit_schedule" CASCADE;--> statement-breakpoint
ALTER TABLE "purchase_order_early_payment_benefits" ADD CONSTRAINT "purchase_order_early_payment_benefits_po_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_early_payment_benefits" ADD CONSTRAINT "purchase_order_early_payment_benefits_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."purchase_order_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_early_payment_benefits" ADD CONSTRAINT "purchase_order_early_payment_benefits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_early_payment_benefits" ADD CONSTRAINT "purchase_order_early_payment_benefits_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_purchase_order_early_payment_benefits_id" ON "purchase_order_early_payment_benefits" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_early_payment_benefits_po_id" ON "purchase_order_early_payment_benefits" USING btree ("purchase_order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_early_payment_benefits_payment_id" ON "purchase_order_early_payment_benefits" USING btree ("payment_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_early_payment_benefits_date" ON "purchase_order_early_payment_benefits" USING btree ("benefit_date" date_ops);