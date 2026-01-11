-- Create settings table for business configuration
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR,
    business_rif VARCHAR,
    business_phone VARCHAR,
    business_email VARCHAR,
    business_address VARCHAR,
    business_website VARCHAR,
    business_logo VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a default empty row (singleton pattern)
INSERT INTO settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
