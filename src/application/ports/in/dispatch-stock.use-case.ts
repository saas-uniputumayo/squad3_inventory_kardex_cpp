import Decimal from 'decimal.js';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../../domain/types';

export interface DispatchStockLineInput {
    productId: string;
    variantId?: string;
    quantity: Decimal.Value;
}

export interface DispatchStockCommand {
    tenantId: string;
    warehouseId: string;
    referenceType?: ReferenceType;
    referenceId?: string;
    referenceDocument: string;
    lines: DispatchStockLineInput[];
    source?: MovementSource;
    notes?: string;
    performedById?: string;
    occurredAt?: Date;
    idempotencyKey?: string;
}

export interface DispatchStockLineResult {
    productId: string;
    variantId: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
    previousStock: string;
    remainingStock: string;
}

export interface DispatchStockResult {
    movementId: string;
    type: MovementType;
    status: MovementStatus;
    warehouseId: string;
    referenceDocument: string;
    lines: DispatchStockLineResult[];
    totalDispatchCost: string;
    createdAt: Date;
}

export interface DispatchStockUseCase {
    execute(command: DispatchStockCommand): Promise<DispatchStockResult>;
}
