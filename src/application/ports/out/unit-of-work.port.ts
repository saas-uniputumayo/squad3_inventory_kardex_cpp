import { IdempotencyPort } from './idempotency.port';
import { InventoryBalanceRepositoryPort } from './inventory-balance-repository.port';
import { InventoryLedgerRepositoryPort } from './inventory-ledger-repository.port';
import { InventoryMovementRepositoryPort } from './inventory-movement-repository.port';
import { InventoryTransferRepositoryPort } from './inventory-transfer-repository.port';
import { ProductRepositoryPort } from './product-repository.port';
import { ProductVariantRepositoryPort } from './product-variant-repository.port';
import { StockCountRepositoryPort } from './stock-count-repository.port';
import { UnitOfMeasureRepositoryPort } from './unit-of-measure-repository.port';
import { WarehouseRepositoryPort } from './warehouse-repository.port';

export interface TransactionalContext {
    readonly productRepository: ProductRepositoryPort;
    readonly productVariantRepository: ProductVariantRepositoryPort;
    readonly warehouseRepository: WarehouseRepositoryPort;
    readonly unitOfMeasureRepository: UnitOfMeasureRepositoryPort;
    readonly inventoryBalanceRepository: InventoryBalanceRepositoryPort;
    readonly inventoryMovementRepository: InventoryMovementRepositoryPort;
    readonly inventoryLedgerRepository: InventoryLedgerRepositoryPort;
    readonly inventoryTransferRepository: InventoryTransferRepositoryPort;
    readonly stockCountRepository: StockCountRepositoryPort;
    readonly idempotencyRepository?: IdempotencyPort;
}

export interface UnitOfWorkPort {
    /**
     * Ejecuta un bloque de operaciones de forma atómica dentro de una misma
     * transacción, exponiendo repositorios vinculados al contexto transaccional.
     */
    execute<T>(work: (context: TransactionalContext) => Promise<T>): Promise<T>;
}
