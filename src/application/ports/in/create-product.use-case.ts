import Decimal from 'decimal.js';
import {
    CostMethod,
    ProductStructure,
    ProductType,
} from '../../../domain/types';

export interface CreateProductCommand {
    tenantId: string;
    sku: string;
    name: string;
    description?: string | null;
    barcode?: string | null;
    categoryId?: string | null;
    productType?: ProductType;
    structure?: ProductStructure;
    unitOfMeasureId: string;
    costPrice: Decimal.Value;
    salePrice: Decimal.Value;
    wholesalePrice?: Decimal.Value | null;
    taxRate?: Decimal.Value;
    minStockAlert?: Decimal.Value;
    costMethod?: CostMethod;
}

export interface CreateProductResult {
    id: string;
    sku: string;
    name: string;
    unitOfMeasureId: string;
    salePrice: string;
    costPrice: string;
    isActive: boolean;
    defaultVariantId?: string;
    createdAt: Date;
}

export interface CreateProductUseCase {
    execute(command: CreateProductCommand): Promise<CreateProductResult>;
}
