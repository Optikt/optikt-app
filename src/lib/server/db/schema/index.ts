// Schema barrel export
// Re-exports all tables and types from individual schema files

// Base tables (no dependencies)
export * from './users';
export * from './brands';
export * from './suppliers';
export * from './customers';
export * from './settings';
export * from './materials';
export * from './exchangeRates';

// Dependent tables
export * from './sessions';
export * from './products';
export * from './lenses';
export * from './prescriptions';
export * from './sales';
export * from './quotes';

// Audit / History
export * from './changeHistory';
