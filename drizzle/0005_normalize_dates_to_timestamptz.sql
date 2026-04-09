-- Migration: normalize all date columns to timestamptz
-- Converts timestamp (without tz) and date columns to timestamptz using AT TIME ZONE 'UTC'

-- sales.sale_date: timestamp → timestamptz
ALTER TABLE "sales" ALTER COLUMN "sale_date" TYPE timestamptz USING "sale_date" AT TIME ZONE 'UTC';

-- quotes.quote_date: timestamp → timestamptz
ALTER TABLE "quotes" ALTER COLUMN "quote_date" TYPE timestamptz USING "quote_date" AT TIME ZONE 'UTC';

-- quotes.valid_until: timestamp → timestamptz
ALTER TABLE "quotes" ALTER COLUMN "valid_until" TYPE timestamptz USING "valid_until" AT TIME ZONE 'UTC';

-- customers.birth_date: date → timestamptz
ALTER TABLE "customers" ALTER COLUMN "birth_date" TYPE timestamptz USING "birth_date"::timestamptz;

-- prescriptions.prescription_date: date → timestamptz
ALTER TABLE "prescriptions" ALTER COLUMN "prescription_date" TYPE timestamptz USING "prescription_date"::timestamptz;

-- exchange_rates.effective_date: date → timestamptz
ALTER TABLE "exchange_rates" ALTER COLUMN "effective_date" TYPE timestamptz USING "effective_date"::timestamptz;
