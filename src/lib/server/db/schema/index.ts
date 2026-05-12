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
export * from './brandAccessories';

// Dependent tables
export * from './brandSuppliers';
export * from './sessions';
export * from './products';
export * from './lenses';
export * from './prescriptions';
export * from './sales';
export * from './quotes';

// Purchase & Inventory
export * from './purchaseOrders';
export * from './inventoryLots';
export * from './inventoryMovements';
export * from './inventoryCount';

// Cash & Finances
export * from './cashExpenses';

// Audit / History
export * from './changeHistory';
