import { ProductStockInfo } from './search-products.use-case';

export interface GetProductDetailQuery {
    tenantId: string;
    productId: string;
    warehouseId?: string;
}

export interface ProductDetailResult {
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
    createdAt: Date;
    updatedAt: Date;
}

export interface GetProductDetailUseCase {
    execute(query: GetProductDetailQuery): Promise<ProductDetailResult>;
}
