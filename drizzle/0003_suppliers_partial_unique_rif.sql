-- Convert suppliers RIF unique index to partial index (only non-deleted)
-- This allows RIF reuse after a supplier has been soft-deleted

DROP INDEX IF EXISTS ix_suppliers_rif;

CREATE UNIQUE INDEX ix_suppliers_rif 
ON suppliers (rif) 
WHERE deleted_at IS NULL;
