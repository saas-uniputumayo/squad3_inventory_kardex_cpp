import { InventoryBalance } from '../../../src/domain/entities/inventory-balance/entity';
import { InventoryLedgerEntry } from '../../../src/domain/entities/inventory-ledger-entry/entity';
import { InventoryMovement } from '../../../src/domain/entities/inventory-movement/entity';
import { InventoryTransfer } from '../../../src/domain/entities/inventory-transfer/entity';
import { Product } from '../../../src/domain/entities/product/entity';
import { ProductVariant } from '../../../src/domain/entities/product/variant.entity';
import { StockCount } from '../../../src/domain/entities/stock-count/entity';
import { UnitOfMeasure } from '../../../src/domain/entities/unit-of-measure/entity';
import { Warehouse } from '../../../src/domain/entities/warehouse/entity';
import { ReferenceType } from '../../../src/domain/types';
import {
    IdempotencyPort,
    IdempotencyRecord,
    SaveIdempotencyParams,
} from '../../../src/application/ports/out/idempotency.port';
import {
    InventoryBalanceKey,
    InventoryBalanceRepositoryPort,
    StockAlertFilter,
    StockAlertItem,
} from '../../../src/application/ports/out/inventory-balance-repository.port';
import {
    InventoryLedgerRepositoryPort,
    KardexQueryFilter,
} from '../../../src/application/ports/out/inventory-ledger-repository.port';
import { InventoryMovementRepositoryPort } from '../../../src/application/ports/out/inventory-movement-repository.port';
import { InventoryTransferRepositoryPort } from '../../../src/application/ports/out/inventory-transfer-repository.port';
import {
    ProductRepositoryPort,
    SearchProductsFilter,
} from '../../../src/application/ports/out/product-repository.port';
import { ProductVariantRepositoryPort } from '../../../src/application/ports/out/product-variant-repository.port';
import { StockCountRepositoryPort } from '../../../src/application/ports/out/stock-count-repository.port';
import { UnitOfMeasureRepositoryPort } from '../../../src/application/ports/out/unit-of-measure-repository.port';
import {
    TransactionalContext,
    UnitOfWorkPort,
} from '../../../src/application/ports/out/unit-of-work.port';
import { WarehouseRepositoryPort } from '../../../src/application/ports/out/warehouse-repository.port';

export class InMemoryIdempotencyPort implements IdempotencyPort {
    private readonly records = new Map<string, IdempotencyRecord<any>>();

    async get<T>(tenantId: string, key: string): Promise<IdempotencyRecord<T> | null> {
        return (this.records.get(`${tenantId}:${key}`) as IdempotencyRecord<T>) ?? null;
    }

    async save<T>(params: SaveIdempotencyParams<T>): Promise<void> {
        this.records.set(`${params.tenantId}:${params.key}`, {
            key: params.key,
            tenantId: params.tenantId,
            operation: params.operation,
            status: 'COMPLETED' as any,
            response: params.response,
            resourceId: params.resourceId,
            createdAt: new Date(),
        });
    }

    async release(tenantId: string, key: string): Promise<void> {
        this.records.delete(`${tenantId}:${key}`);
    }

    setRecord<T>(tenantId: string, key: string, record: IdempotencyRecord<T>): void {
        this.records.set(`${tenantId}:${key}`, record);
    }
}

export class InMemoryProductRepository implements ProductRepositoryPort {
    public products: Product[] = [];

    async findById(tenantId: string, id: string): Promise<Product | null> {
        return this.products.find((p) => p.getTenantId() === tenantId && p.getId() === id) ?? null;
    }

    async findBySku(tenantId: string, sku: string): Promise<Product | null> {
        return this.products.find((p) => p.getTenantId() === tenantId && p.getSku().getValue() === sku) ?? null;
    }

    async findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
        return this.products.find((p) => p.getTenantId() === tenantId && p.getBarcode() === barcode) ?? null;
    }

    async search(tenantId: string, filter: SearchProductsFilter): Promise<{ products: Product[]; total: number }> {
        let result = this.products.filter((p) => p.getTenantId() === tenantId);

        if (filter.search) {
            const s = filter.search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.getName().toLowerCase().includes(s) ||
                    p.getSku().getValue().toLowerCase().includes(s) ||
                    (p.getBarcode() && p.getBarcode()!.toLowerCase().includes(s)),
            );
        }

        if (filter.isActive !== undefined) {
            result = result.filter((p) => p.isActive() === filter.isActive);
        }

        return { products: result, total: result.length };
    }

    async hasMovementsOrHistory(tenantId: string, id: string): Promise<boolean> {
        return false;
    }

    async delete(tenantId: string, id: string): Promise<void> {
        this.products = this.products.filter((p) => !(p.getTenantId() === tenantId && p.getId() === id));
    }

    async save(product: Product): Promise<void> {
        const idx = this.products.findIndex((p) => p.getId() === product.getId());
        if (idx !== -1) {
            this.products[idx] = product;
        } else {
            this.products.push(product);
        }
    }
}

export class InMemoryProductVariantRepository implements ProductVariantRepositoryPort {
    public variants: ProductVariant[] = [];

    async findById(tenantId: string, id: string): Promise<ProductVariant | null> {
        return this.variants.find((v) => v.getTenantId() === tenantId && v.getId() === id) ?? null;
    }

    async findBySku(tenantId: string, sku: string): Promise<ProductVariant | null> {
        return this.variants.find((v) => v.getTenantId() === tenantId && v.getSku().getValue() === sku) ?? null;
    }

    async findDefaultByProductId(tenantId: string, productId: string): Promise<ProductVariant | null> {
        return (
            this.variants.find(
                (v) => v.getTenantId() === tenantId && v.getProductId() === productId && v.getIsDefault(),
            ) ?? null
        );
    }

    async findByProductId(tenantId: string, productId: string): Promise<ProductVariant[]> {
        return this.variants.filter((v) => v.getTenantId() === tenantId && v.getProductId() === productId);
    }

    async save(variant: ProductVariant): Promise<void> {
        const idx = this.variants.findIndex((v) => v.getId() === variant.getId());
        if (idx !== -1) {
            this.variants[idx] = variant;
        } else {
            this.variants.push(variant);
        }
    }

    async saveMany(variants: ProductVariant[]): Promise<void> {
        for (const v of variants) {
            await this.save(v);
        }
    }
}

export class InMemoryWarehouseRepository implements WarehouseRepositoryPort {
    public warehouses: Warehouse[] = [];

    async findById(tenantId: string, id: string): Promise<Warehouse | null> {
        return this.warehouses.find((w) => w.getTenantId() === tenantId && w.getId() === id) ?? null;
    }

    async findByCode(tenantId: string, code: string): Promise<Warehouse | null> {
        return this.warehouses.find((w) => w.getTenantId() === tenantId && w.getCode().getValue() === code) ?? null;
    }

    async findAll(tenantId: string, filter?: { onlyActive?: boolean; branchId?: string }): Promise<Warehouse[]> {
        let result = this.warehouses.filter((w) => w.getTenantId() === tenantId);
        if (filter?.onlyActive !== undefined) {
            result = result.filter((w) => w.isActive() === filter.onlyActive);
        }
        if (filter?.branchId) {
            result = result.filter((w) => w.getBranchId() === filter.branchId);
        }
        return result;
    }

    async save(warehouse: Warehouse): Promise<void> {
        const idx = this.warehouses.findIndex((w) => w.getId() === warehouse.getId());
        if (idx !== -1) {
            this.warehouses[idx] = warehouse;
        } else {
            this.warehouses.push(warehouse);
        }
    }
}

export class InMemoryUnitOfMeasureRepository implements UnitOfMeasureRepositoryPort {
    public units: UnitOfMeasure[] = [];

    async findById(tenantId: string, id: string): Promise<UnitOfMeasure | null> {
        return this.units.find((u) => u.getTenantId() === tenantId && u.getId() === id) ?? null;
    }

    async findByCode(tenantId: string, code: string): Promise<UnitOfMeasure | null> {
        return this.units.find((u) => u.getTenantId() === tenantId && u.getCode().toString() === code) ?? null;
    }

    async findAll(tenantId: string): Promise<UnitOfMeasure[]> {
        return this.units.filter((u) => u.getTenantId() === tenantId);
    }

    async save(unit: UnitOfMeasure): Promise<void> {
        const idx = this.units.findIndex((u) => u.getId() === unit.getId());
        if (idx !== -1) {
            this.units[idx] = unit;
        } else {
            this.units.push(unit);
        }
    }
}

export class InMemoryInventoryBalanceRepository implements InventoryBalanceRepositoryPort {
    public balances: InventoryBalance[] = [];
    public lockRequests: Array<{ warehouseId: string; productId: string; variantId: string }> = [];

    async findById(tenantId: string, id: string): Promise<InventoryBalance | null> {
        return this.balances.find((b) => b.getTenantId() === tenantId && b.getId() === id) ?? null;
    }

    async findByLocation(
        tenantId: string,
        warehouseId: string,
        productId: string,
        variantId: string,
    ): Promise<InventoryBalance | null> {
        return (
            this.balances.find(
                (b) =>
                    b.getTenantId() === tenantId &&
                    b.getWarehouseId() === warehouseId &&
                    b.getProductId() === productId &&
                    b.getVariantId() === variantId,
            ) ?? null
        );
    }

    async findForUpdate(
        tenantId: string,
        warehouseId: string,
        productId: string,
        variantId: string,
    ): Promise<InventoryBalance | null> {
        this.lockRequests.push({ warehouseId, productId, variantId });
        return this.findByLocation(tenantId, warehouseId, productId, variantId);
    }

    async findManyForUpdate(tenantId: string, keys: InventoryBalanceKey[]): Promise<InventoryBalance[]> {
        const results: InventoryBalance[] = [];
        for (const k of keys) {
            const b = await this.findForUpdate(tenantId, k.warehouseId, k.productId, k.variantId);
            if (b) results.push(b);
        }
        return results;
    }

    async save(balance: InventoryBalance): Promise<void> {
        const idx = this.balances.findIndex((b) => b.getId() === balance.getId());
        if (idx !== -1) {
            this.balances[idx] = balance;
        } else {
            this.balances.push(balance);
        }
    }

    async saveMany(balances: InventoryBalance[]): Promise<void> {
        for (const b of balances) {
            await this.save(b);
        }
    }

    async findByWarehouse(tenantId: string, warehouseId: string): Promise<InventoryBalance[]> {
        return this.balances.filter((b) => b.getTenantId() === tenantId && b.getWarehouseId() === warehouseId);
    }

    async findLowStockAlerts(
        tenantId: string,
        filter?: StockAlertFilter,
    ): Promise<{ items: StockAlertItem[]; total: number }> {
        return { items: [], total: 0 };
    }
}

export class InMemoryInventoryMovementRepository implements InventoryMovementRepositoryPort {
    public movements: InventoryMovement[] = [];

    async findById(tenantId: string, id: string): Promise<InventoryMovement | null> {
        return this.movements.find((m) => m.getTenantId() === tenantId && m.getId() === id) ?? null;
    }

    async findByReference(
        tenantId: string,
        referenceType: ReferenceType,
        referenceId: string,
    ): Promise<InventoryMovement | null> {
        return (
            this.movements.find(
                (m) =>
                    m.getTenantId() === tenantId &&
                    m.getReference().getType() === referenceType &&
                    m.getReference().getId() === referenceId,
            ) ?? null
        );
    }

    async findByReferenceDocument(tenantId: string, referenceDocument: string): Promise<InventoryMovement[]> {
        return this.movements.filter(
            (m) => m.getTenantId() === tenantId && m.getReference().getId() === referenceDocument,
        );
    }

    async save(movement: InventoryMovement): Promise<void> {
        const idx = this.movements.findIndex((m) => m.getId() === movement.getId());
        if (idx !== -1) {
            this.movements[idx] = movement;
        } else {
            this.movements.push(movement);
        }
    }
}

export class InMemoryInventoryLedgerRepository implements InventoryLedgerRepositoryPort {
    public entries: InventoryLedgerEntry[] = [];

    async save(entry: InventoryLedgerEntry): Promise<void> {
        this.entries.push(entry);
    }

    async saveMany(entries: InventoryLedgerEntry[]): Promise<void> {
        this.entries.push(...entries);
    }

    async findByProduct(
        tenantId: string,
        filter: KardexQueryFilter,
    ): Promise<{ entries: InventoryLedgerEntry[]; total: number }> {
        let result = this.entries.filter((e) => e.getTenantId() === tenantId && e.getProductId() === filter.productId);

        if (filter.warehouseId) {
            result = result.filter((e) => e.getWarehouseId() === filter.warehouseId);
        }
        if (filter.variantId) {
            result = result.filter((e) => e.getVariantId() === filter.variantId);
        }
        if (filter.movementType) {
            result = result.filter((e) => e.getMovementType() === filter.movementType);
        }

        return { entries: result, total: result.length };
    }
}

export class InMemoryInventoryTransferRepository implements InventoryTransferRepositoryPort {
    public transfers: InventoryTransfer[] = [];

    async findById(tenantId: string, id: string): Promise<InventoryTransfer | null> {
        return this.transfers.find((t) => t.getTenantId() === tenantId && t.getId() === id) ?? null;
    }

    async save(transfer: InventoryTransfer): Promise<void> {
        const idx = this.transfers.findIndex((t) => t.getId() === transfer.getId());
        if (idx !== -1) {
            this.transfers[idx] = transfer;
        } else {
            this.transfers.push(transfer);
        }
    }
}

export class InMemoryStockCountRepository implements StockCountRepositoryPort {
    public stockCounts: StockCount[] = [];

    async findById(tenantId: string, id: string): Promise<StockCount | null> {
        return this.stockCounts.find((s) => s.getTenantId() === tenantId && s.getId() === id) ?? null;
    }

    async save(stockCount: StockCount): Promise<void> {
        const idx = this.stockCounts.findIndex((s) => s.getId() === stockCount.getId());
        if (idx !== -1) {
            this.stockCounts[idx] = stockCount;
        } else {
            this.stockCounts.push(stockCount);
        }
    }
}

export class InMemoryUnitOfWork implements UnitOfWorkPort {
    public executeCount = 0;

    constructor(private readonly context: TransactionalContext) { }

    async execute<T>(work: (context: TransactionalContext) => Promise<T>): Promise<T> {
        this.executeCount += 1;
        return work(this.context);
    }
}
