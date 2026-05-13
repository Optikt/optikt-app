ALTER TABLE "brand_accessories" ADD COLUMN "price_mode" varchar(20) DEFAULT 'COURTESY' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_accessories" ADD COLUMN "custom_price" double precision;--> statement-breakpoint
UPDATE "brand_accessories"
SET
	"price_mode" = CASE
		WHEN "default_price" > 0 THEN 'CUSTOM'
		ELSE 'COURTESY'
	END,
	"custom_price" = CASE
		WHEN "default_price" > 0 THEN "default_price"
		ELSE NULL
	END;--> statement-breakpoint
ALTER TABLE "brand_accessories" DROP COLUMN "default_price";