// ─── Use Cases (Inbound Ports) ───────────────────────────────────────────────
export const CREATE_PRODUCT_USE_CASE = Symbol('CREATE_PRODUCT_USE_CASE');
export const UPDATE_PRODUCT_USE_CASE = Symbol('UPDATE_PRODUCT_USE_CASE');
export const SEARCH_PRODUCTS_USE_CASE = Symbol('SEARCH_PRODUCTS_USE_CASE');
export const GET_PRODUCT_DETAIL_USE_CASE = Symbol('GET_PRODUCT_DETAIL_USE_CASE');

export const LIST_WAREHOUSES_USE_CASE = Symbol('LIST_WAREHOUSES_USE_CASE');

export const RECEIVE_STOCK_USE_CASE = Symbol('RECEIVE_STOCK_USE_CASE');
export const DISPATCH_STOCK_USE_CASE = Symbol('DISPATCH_STOCK_USE_CASE');
export const REVERSE_MOVEMENT_USE_CASE = Symbol('REVERSE_MOVEMENT_USE_CASE');

export const TRANSFER_STOCK_USE_CASE = Symbol('TRANSFER_STOCK_USE_CASE');
export const RECEIVE_TRANSFER_USE_CASE = Symbol('RECEIVE_TRANSFER_USE_CASE');

export const GET_KARDEX_USE_CASE = Symbol('GET_KARDEX_USE_CASE');
export const GET_STOCK_ALERTS_USE_CASE = Symbol('GET_STOCK_ALERTS_USE_CASE');

export const CREATE_STOCK_COUNT_USE_CASE = Symbol('CREATE_STOCK_COUNT_USE_CASE');
export const APPLY_STOCK_COUNT_USE_CASE = Symbol('APPLY_STOCK_COUNT_USE_CASE');

// ─── Output Ports (Repository & Transaction Abstractions) ────────────────────
export const PRODUCT_REPOSITORY_PORT = Symbol('ProductRepositoryPort');
export const PRODUCT_VARIANT_REPOSITORY_PORT = Symbol('ProductVariantRepositoryPort');
export const WAREHOUSE_REPOSITORY_PORT = Symbol('WarehouseRepositoryPort');
export const UNIT_OF_MEASURE_REPOSITORY_PORT = Symbol('UnitOfMeasureRepositoryPort');
export const INVENTORY_BALANCE_REPOSITORY_PORT = Symbol('InventoryBalanceRepositoryPort');
export const INVENTORY_MOVEMENT_REPOSITORY_PORT = Symbol('InventoryMovementRepositoryPort');
export const INVENTORY_LEDGER_REPOSITORY_PORT = Symbol('InventoryLedgerRepositoryPort');
export const INVENTORY_TRANSFER_REPOSITORY_PORT = Symbol('InventoryTransferRepositoryPort');
export const STOCK_COUNT_REPOSITORY_PORT = Symbol('StockCountRepositoryPort');
export const UNIT_OF_WORK_PORT = Symbol('UnitOfWorkPort');
export const IDEMPOTENCY_PORT = Symbol('IdempotencyPort');
