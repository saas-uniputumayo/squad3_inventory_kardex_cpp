import Decimal from 'decimal.js';

export interface UpdateProductCommand {
    tenantId: string;
    productId: string;
    name?: string;
    description?: string | null;
    barcode?: string | null;
    categoryId?: string | null;
    salePrice?: Decimal.Value;
    wholesalePrice?: Decimal.Value | null;
    costPrice?: Decimal.Value;
    taxRate?: Decimal.Value;
    minStockAlert?: Decimal.Value;
    unitOfMeasureId?: string;
    isActive?: boolean;
}

export interface UpdateProductResult {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    barcode: string | null;
    categoryId: string | null;
    unitOfMeasureId: string;
    costPrice: string;
    salePrice: string;
    wholesalePrice: string | null;
    taxRate: string;
    minStockAlert: string;
    isActive: boolean;
    updatedAt: Date;
}

export interface UpdateProductUseCase {
    execute(command: UpdateProductCommand): Promise<UpdateProductResult>;
}
