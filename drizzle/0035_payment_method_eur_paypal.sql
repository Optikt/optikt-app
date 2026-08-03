-- Add EFECTIVO_EUR and PAYPAL to the shared payment_method enum.
--> statement-breakpoint

ALTER TYPE "public"."payment_method" ADD VALUE 'EFECTIVO_EUR';--> statement-breakpoint

ALTER TYPE "public"."payment_method" ADD VALUE 'PAYPAL';
