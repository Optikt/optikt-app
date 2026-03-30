ALTER TABLE "sales" ALTER COLUMN "order_number" DROP DEFAULT;
ALTER TABLE "sales" ALTER COLUMN "order_number" SET DATA TYPE integer;
DROP SEQUENCE IF EXISTS "sales_order_number_seq";