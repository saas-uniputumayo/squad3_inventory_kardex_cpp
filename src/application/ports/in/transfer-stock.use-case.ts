import Decimal from 'decimal.js';
import { TransferStatus } from '../../../domain/types';

export interface TransferStockLineInput {
    productId: string;
    variantId?: string;
    quantity: Decimal.Value;
}

export interface TransferStockCommand {
    tenantId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    referenceDocument: string;
    reason?: string;
    lines: TransferStockLineInput[];
    isTwoPhase?: boolean;
    notes?: string;
    performedById?: string;
    occurredAt?: Date;
    idempotencyKey?: string;
}

export interface TransferStockLineResult {
    productId: string;
    variantId: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
}

export interface TransferStockResult {
    transferId: string;
    status: TransferStatus;
    referenceDocument: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    lines: TransferStockLineResult[];
    outboundMovementId?: string;
    inboundMovementId?: string;
    createdAt: Date;
}

export interface TransferStockUseCase {
    execute(command: TransferStockCommand): Promise<TransferStockResult>;
}
