import { InventoryMovement } from '../../../domain/entities/inventory-movement/entity';
import { ReferenceType } from '../../../domain/types';

export interface InventoryMovementRepositoryPort {
    save(movement: InventoryMovement): Promise<void>;
    findById(tenantId: string, id: string): Promise<InventoryMovement | null>;
    findByReference(
        tenantId: string,
        referenceType: ReferenceType,
        referenceId: string,
    ): Promise<InventoryMovement | null>;
    findByReferenceDocument(
        tenantId: string,
        referenceDocument: string,
    ): Promise<InventoryMovement[]>;
}
