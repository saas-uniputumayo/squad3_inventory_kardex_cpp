import { InventoryLedgerEntry } from '../../../domain/entities/inventory-ledger-entry/entity';
import { MovementType } from '../../../domain/types';

export interface KardexQueryFilter {
    productId: string;
    variantId?: string;
    warehouseId?: string;
    from?: Date;
    to?: Date;
    movementType?: MovementType;
    page?: number;
    limit?: number;
}

export interface InventoryLedgerRepositoryPort {
    save(entry: InventoryLedgerEntry): Promise<void>;
    saveMany(entries: InventoryLedgerEntry[]): Promise<void>;
    findByProduct(
        tenantId: string,
        filter: KardexQueryFilter,
    ): Promise<{ entries: InventoryLedgerEntry[]; total: number }>;
}
