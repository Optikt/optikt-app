-- Fix contact_name column type from JSON to VARCHAR
ALTER TABLE suppliers ALTER COLUMN contact_name TYPE varchar USING contact_name::text;
