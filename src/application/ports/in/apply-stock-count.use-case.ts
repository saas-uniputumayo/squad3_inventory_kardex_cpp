import Decimal from 'decimal.js';
import { StockCountStatus } from '../../../domain/types';

export interface CountLineInput {
    lineId: string;
    countedQuantity: Decimal.Value;
    notes?: string;
}

export interface ApplyStockCountCommand {
    tenantId: string;
    stockCountId: string;
    counts?: CountLineInput[];
    performedById?: string;
    idempotencyKey?: string;
}

export interface AppliedAdjustmentLineResult {
    productId: string;
    variantId: string;
    systemQuantity: string;
    countedQuantity: string;
    differenceQuantity: string;
    adjustmentType: 'SURPLUS' | 'SHORTAGE' | 'EQUAL';
    movementId?: string;
}

export interface ApplyStockCountResult {
    stockCountId: string;
    status: StockCountStatus;
    totalLines: number;
    adjustedLines: number;
    lines: AppliedAdjustmentLineResult[];
    completedAt: Date;
}

export interface ApplyStockCountUseCase {
    execute(command: ApplyStockCountCommand): Promise<ApplyStockCountResult>;
}
