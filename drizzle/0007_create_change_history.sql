-- Change History / Audit Log Table
-- Tracks all changes to key entities (products, customers, prescriptions, sales, etc.)

CREATE TABLE change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity identification
    entity_type VARCHAR NOT NULL,           -- 'product', 'customer', 'prescription', 'sale', etc.
    entity_id UUID NOT NULL,                -- The ID of the changed record
    
    -- Change metadata
    action VARCHAR NOT NULL,                -- 'create', 'update', 'delete', 'restore'
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Change details
    changes JSONB NOT NULL,                 -- { field: { old: value, new: value } }
    snapshot JSONB,                         -- Full entity state before change (optional)
    
    -- Context
    reason VARCHAR,                         -- Optional reason for change
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX ix_change_history_entity ON change_history(entity_type, entity_id);
CREATE INDEX ix_change_history_changed_at ON change_history(changed_at DESC);
CREATE INDEX ix_change_history_changed_by ON change_history(changed_by_id);
CREATE INDEX ix_change_history_action ON change_history(action);

-- Add is_current flag to prescriptions for reliable "current prescription" detection
ALTER TABLE prescriptions ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT false;

-- Set current prescription for each customer (one-time migration)
-- The most recent prescription by prescription_date (and created_at as tiebreaker) becomes current
WITH ranked AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY customer_id 
           ORDER BY prescription_date DESC, created_at DESC
         ) as rn
  FROM prescriptions
  WHERE deleted_at IS NULL
)
UPDATE prescriptions 
SET is_current = true
FROM ranked 
WHERE prescriptions.id = ranked.id AND ranked.rn = 1;
