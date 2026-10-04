import { InventoryTransfer } from '../../../domain/entities/inventory-transfer/entity';

export interface InventoryTransferRepositoryPort {
    save(transfer: InventoryTransfer): Promise<void>;
    findById(tenantId: string, id: string): Promise<InventoryTransfer | null>;
}
