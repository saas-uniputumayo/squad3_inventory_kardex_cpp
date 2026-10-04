export interface GetStockAlertsQuery {
    tenantId: string;
    warehouseId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface StockAlertItemResult {
    productId: string;
    variantId: string;
    sku: string;
    barcode: string | null;
    name: string;
    unitOfMeasure: string;
    warehouseId: string;
    warehouseName: string;
    currentStock: string;
    reservedStock: string;
    availableStock: string;
    minimumStock: string;
    shortage: string;
    salePrice: string;
}

export interface StockAlertsResult {
    data: StockAlertItemResult[];
    meta: {
        total: number;
    };
}

export interface GetStockAlertsUseCase {
    execute(query: GetStockAlertsQuery): Promise<StockAlertsResult>;
}
