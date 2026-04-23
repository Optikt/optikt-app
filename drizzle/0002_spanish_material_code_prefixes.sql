UPDATE "materials"
SET "code" = regexp_replace("code", '^FR_', 'MO_')
WHERE "product_type" = 'FRAME'
	AND "code" LIKE 'FR\_%' ESCAPE '\\';--> statement-breakpoint

UPDATE "materials"
SET "code" = regexp_replace("code", '^SG_', 'MO_')
WHERE "product_type" = 'FRAME'
	AND "code" LIKE 'SG\_%' ESCAPE '\\';--> statement-breakpoint

UPDATE "materials"
SET "code" = regexp_replace("code", '^CL_', 'LC_')
WHERE "product_type" = 'CONTACT_LENS'
	AND "code" LIKE 'CL\_%' ESCAPE '\\';--> statement-breakpoint