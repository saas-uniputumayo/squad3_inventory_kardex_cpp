import { InventoryBalance } from '../../../domain/entities/inventory-balance/entity';
import { Product } from '../../../domain/entities/product/entity';
import { ProductVariant } from '../../../domain/entities/product/variant.entity';
import { Warehouse } from '../../../domain/entities/warehouse/entity';

export interface StockAlertItem {
    balance: InventoryBalance;
    product: Product;
    variant: ProductVariant;
    warehouse: Warehouse;
}

export interface StockAlertFilter {
    warehouseId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface InventoryBalanceKey {
    warehouseId: string;
    productId: string;
    variantId: string;
}

export interface InventoryBalanceRepositoryPort {
    findById(tenantId: string, id: string): Promise<InventoryBalance | null>;

    findByLocation(
        tenantId: string,
        warehouseId: string,
        productId: string,
        variantId: string,
    ): Promise<InventoryBalance | null>;

    /**
     * Obtiene el balance de inventario adquiriendo un bloqueo pesimista
     * para asegurar aislamiento y consistencia ante operaciones concurrentes.
     */
    findForUpdate(
        tenantId: string,
        warehouseId: string,
        productId: string,
        variantId: string,
    ): Promise<InventoryBalance | null>;

    /**
     * Obtiene múltiples balances adquiriendo bloqueo pesimista en orden determinístico
     * para evitar interbloqueos (deadlocks) en operaciones multi-producto o entre bodegas.
     */
    findManyForUpdate(
        tenantId: string,
        keys: InventoryBalanceKey[],
    ): Promise<InventoryBalance[]>;

    save(balance: InventoryBalance): Promise<void>;

    saveMany(balances: InventoryBalance[]): Promise<void>;

    findByWarehouse(
        tenantId: string,
        warehouseId: string,
    ): Promise<InventoryBalance[]>;

    findLowStockAlerts(
        tenantId: string,
        filter?: StockAlertFilter,
    ): Promise<{ items: StockAlertItem[]; total: number }>;
}
