-- Add shipping_cost_pending flag to sale_items
ALTER TABLE "sale_items" ADD COLUMN "shipping_cost_pending" boolean DEFAULT false;btree ("currency_id" uuid_ops,"effective_date" timestamptz_ops);