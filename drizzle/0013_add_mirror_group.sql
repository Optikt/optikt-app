-- Migration: Add mirror_group column to lens_optical_ranges
-- Rows that form a symmetric (±) pair share the same mirror_group UUID.
-- Rows without a mirror partner have mirror_group = NULL.

ALTER TABLE "lens_optical_ranges"
    ADD COLUMN "mirror_group" uuid;

-- Index for fast grouping when loading ranges for edit
CREATE INDEX "ix_lens_optical_ranges_mirror_group"
    ON "lens_optical_ranges" USING btree ("mirror_group" ASC NULLS LAST)
    WHERE "mirror_group" IS NOT NULL;
