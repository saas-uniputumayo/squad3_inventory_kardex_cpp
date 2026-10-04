export interface SearchProductsQuery {
    tenantId: string;
    search?: string;
    sku?: string;
    barcode?: string;
    categoryId?: string;
    warehouseId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export interface ProductStockInfo {
    quantityOnHand: string;
    reservedQuantity: string;
    availableQuantity: string;
    averageCost: string;
    inventoryValue: string;
}

export interface ProductSummaryItem {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    categoryId: string | null;
    unitOfMeasure: {
        id: string;
        code: string;
        name: string;
    };
    costPrice: string;
    salePrice: string;
    wholesalePrice: string | null;
    taxRate: string;
    minStockAlert: string;
    isActive: boolean;
    stock?: ProductStockInfo;
}

export interface SearchProductsResult {
    data: ProductSummaryItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface SearchProductsUseCase {
    execute(query: SearchProductsQuery): Promise<SearchProductsResult>;
}
