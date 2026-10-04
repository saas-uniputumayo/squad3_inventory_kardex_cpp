import Decimal from 'decimal.js';
import {
    MovementSource,
    MovementStatus,
    MovementType,
    ReferenceType,
} from '../../../domain/types';

export interface ReceiveStockLineInput {
    productId: string;
    variantId?: string;
    quantity: Decimal.Value;
    unitCost: Decimal.Value;
}

export interface ReceiveStockCommand {
    tenantId: string;
    warehouseId: string;
    referenceType?: ReferenceType;
    referenceId?: string;
    referenceDocument: string;
    lines: ReceiveStockLineInput[];
    source?: MovementSource;
    notes?: string;
    performedById?: string;
    occurredAt?: Date;
    idempotencyKey?: string;
}

export interface ReceiveStockLineResult {
    productId: string;
    variantId: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
    previousStock: string;
    newStock: string;
    previousAverageCost: string;
    newAverageCost: string;
}

export interface ReceiveStockResult {
    movementId: string;
    type: MovementType;
    status: MovementStatus;
    warehouseId: string;
    referenceDocument: string;
    lines: ReceiveStockLineResult[];
    totalReceivedCost: string;
    createdAt: Date;
}

export interface ReceiveStockUseCase {
    execute(command: ReceiveStockCommand): Promise<ReceiveStockResult>;
}
