ALTER TABLE "prescriptions" ADD COLUMN "dp" double precision;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "np_right" double precision;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "np_left" double precision;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "treatments" json;--> statement-breakpoint
ALTER TABLE "materials" DROP COLUMN "refractive_index";--> statement-breakpoint
ALTER TABLE "prescriptions" DROP COLUMN "pd";--> statement-breakpoint
ALTER TABLE "prescriptions" DROP COLUMN "pd_right";--> statement-breakpoint
ALTER TABLE "prescriptions" DROP COLUMN "pd_left";