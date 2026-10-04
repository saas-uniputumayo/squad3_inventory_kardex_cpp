import { StockCountStatus } from '../../../domain/types';

export interface CreateStockCountCommand {
    tenantId: string;
    warehouseId: string;
    notes?: string;
    performedById?: string;
    productIds?: string[];
    autoStart?: boolean;
}

export interface StockCountLineSummaryResult {
    id: string;
    productId: string;
    variantId: string;
    systemQuantity: string;
}

export interface CreateStockCountResult {
    id: string;
    warehouseId: string;
    status: StockCountStatus;
    linesCount: number;
    lines: StockCountLineSummaryResult[];
    createdAt: Date;
    startedAt?: Date;
}

export interface CreateStockCountUseCase {
    execute(command: CreateStockCountCommand): Promise<CreateStockCountResult>;
}
