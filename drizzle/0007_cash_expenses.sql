-- Cash & Finances module: cash_expenses table + indexes + FKs
-- Idempotent: safe to re-run. Other "drift" detected by drizzle-kit
-- (free-item details, snapshot_tax_rate moves, product physical attrs) is
-- intentionally omitted because earlier migrations already applied it
-- in production / dev DBs. See repo memory: drizzle-migration-journal-drift-repair.

CREATE TABLE IF NOT EXISTS "cash_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" varchar(500) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"amount" double precision NOT NULL,
	"amount_usd" double precision NOT NULL,
	"exchange_rate" double precision,
	"bcv_rate" double precision,
	"rate_type" varchar(20),
	"expense_date" timestamp with time zone NOT NULL,
	"registered_by_id" uuid NOT NULL,
	"reference" varchar(100),
	"notes" varchar(1000),
	"voided_at" timestamp with time zone,
	"voided_by_id" uuid,
	"void_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cash_expenses"
		ADD CONSTRAINT "cash_expenses_registered_by_id_fkey"
		FOREIGN KEY ("registered_by_id") REFERENCES "public"."users"("id")
		ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cash_expenses"
		ADD CONSTRAINT "cash_expenses_voided_by_id_fkey"
		FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id")
		ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_cash_expenses_id" ON "cash_expenses" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_cash_expenses_expense_date" ON "cash_expenses" USING btree ("expense_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_cash_expenses_category" ON "cash_expenses" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_cash_expenses_registered_by" ON "cash_expenses" USING btree ("registered_by_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_cash_expenses_active_by_date" ON "cash_expenses" USING btree ("expense_date" timestamptz_ops) WHERE "cash_expenses"."voided_at" IS NULL;
