CREATE TYPE "public"."purchase_payment_currency" AS ENUM('USD_BCV', 'EUR_BCV', 'USDT', 'USD_PAYPAL', 'USD_EFECTIVO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."purchase_payment_terms" AS ENUM('CONTADO', 'CREDIT');--> statement-breakpoint
CREATE TABLE "purchase_order_credit_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"expected_amount_usd" double precision,
	"early_payment_discount_percent" double precision,
	"early_payment_discount_deadline" date,
	"notes" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"payment_number" integer NOT NULL,
	"currency_code" "purchase_payment_currency" NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"amount" double precision NOT NULL,
	"bcv_usd_rate" double precision NOT NULL,
	"specific_rate" double precision,
	"amount_bs" double precision NOT NULL,
	"amount_usd_bcv" double precision NOT NULL,
	"reference" varchar,
	"notes" varchar,
	"voided_at" timestamp with time zone,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "payment_terms" "purchase_payment_terms" DEFAULT 'CONTADO' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_credit_schedule" ADD CONSTRAINT "purchase_order_credit_schedule_po_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_payments" ADD CONSTRAINT "purchase_order_payments_po_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_payments" ADD CONSTRAINT "purchase_order_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_purchase_order_credit_schedule_id" ON "purchase_order_credit_schedule" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_credit_schedule_po_id" ON "purchase_order_credit_schedule" USING btree ("purchase_order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_credit_schedule_due_date" ON "purchase_order_credit_schedule" USING btree ("due_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_order_credit_schedule_po_number" ON "purchase_order_credit_schedule" USING btree ("purchase_order_id" uuid_ops,"installment_number" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_payments_id" ON "purchase_order_payments" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_payments_po_id" ON "purchase_order_payments" USING btree ("purchase_order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_payments_payment_date" ON "purchase_order_payments" USING btree ("payment_date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_order_payments_po_number" ON "purchase_order_payments" USING btree ("purchase_order_id" uuid_ops,"payment_number" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_orders_payment_terms" ON "purchase_orders" USING btree ("payment_terms");