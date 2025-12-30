// Schema barrel export
// Re-exports all tables and types from individual schema files

// Base tables (no dependencies)
export * from './users';
export * from './brands';
export * from './suppliers';
export * from './customers';

// Dependent tables
export * from './sessions';
export * from './products';
export * from './lenses';
export * from './prescriptions';
export * from './sales';
